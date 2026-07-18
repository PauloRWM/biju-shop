<?php
defined( 'ABSPATH' ) || exit;

/**
 * Integração do React com o plugin "Carrinho Abandonado Wesley Bijoux".
 *
 * Tabela: {prefix}wc_abandoned_carts
 *   id, user_id (nullable), email (nullable), phone, name,
 *   qtdTotal, cart_data (PHP serialized), last_activity
 *
 * Comportamento:
 *  - Usuário logado → identificado por user_id (1 registro por usuário).
 *  - Guest (não logado) → só é gravado se tiver email OU phone. Identificado
 *    por email (preferência) ou phone, sem user_id. 1 registro por email/phone.
 */
class Biju_Abandoned_Cart {

    public static function table() {
        global $wpdb;
        return $wpdb->prefix . 'wc_abandoned_carts';
    }

    /**
     * POST /biju/v1/cart/save
     * Body: { items: [...], email?, phone?, name? }
     *
     * Endpoint público — não exige JWT. Se houver token, prevalece user_id.
     */
    public static function save( WP_REST_Request $request ) {
        $user_id = (int) Biju_Auth::get_user_from_request( $request );
        $email   = sanitize_email( (string) $request->get_param( 'email' ) );
        $phone   = self::normalize_phone( (string) $request->get_param( 'phone' ) );
        $name    = sanitize_text_field( (string) $request->get_param( 'name' ) );

        // Se logado, sobrescreve email/nome a partir do user (mais confiável).
        if ( $user_id > 0 ) {
            $user = get_user_by( 'id', $user_id );
            if ( $user ) {
                $email = $user->user_email;
                if ( $name === '' ) {
                    $name = trim( $user->first_name . ' ' . $user->last_name ) ?: $user->display_name;
                }
            }
        }

        // Sem identificador → não tem como gravar útil. Ignora silenciosamente.
        if ( $user_id <= 0 && $email === '' && $phone === '' ) {
            return rest_ensure_response( [ 'success' => true, 'skipped' => 'no_identifier' ] );
        }

        $raw_items = $request->get_param( 'items' );
        if ( ! is_array( $raw_items ) || empty( $raw_items ) ) {
            self::delete_for( $user_id, $email, $phone );
            return rest_ensure_response( [ 'success' => true, 'cleared' => true ] );
        }

        $normalized = [];
        $qtd_total  = 0;
        foreach ( $raw_items as $item ) {
            $product_id   = isset( $item['product_id'] ) ? absint( $item['product_id'] ) : 0;
            $variation_id = isset( $item['variation_id'] ) ? absint( $item['variation_id'] ) : 0;
            $quantity     = isset( $item['quantity'] ) ? max( 1, absint( $item['quantity'] ) ) : 1;
            if ( ! $product_id ) continue;

            $product = $variation_id ? wc_get_product( $variation_id ) : wc_get_product( $product_id );
            if ( ! $product ) continue;

            $line_total = isset( $item['line_total'] )
                ? (float) $item['line_total']
                : (float) $product->get_price() * $quantity;

            $key = md5( $product_id . ':' . $variation_id );
            $normalized[ $key ] = [
                'product_id'   => $product_id,
                'variation_id' => $variation_id,
                'quantity'     => $quantity,
                'name'         => $product->get_name(),
                'line_total'   => $line_total,
            ];
            $qtd_total += $quantity;
        }

        if ( empty( $normalized ) ) {
            self::delete_for( $user_id, $email, $phone );
            return rest_ensure_response( [ 'success' => true, 'cleared' => true ] );
        }

        global $wpdb;
        $table     = self::table();
        $now       = current_time( 'mysql' );
        $cart_data = maybe_serialize( $normalized );

        $existing_id = self::find_existing_id( $user_id, $email, $phone );

        $data = [
            'user_id'       => $user_id > 0 ? $user_id : null,
            'email'         => $email !== '' ? $email : null,
            'phone'         => $phone !== '' ? $phone : null,
            'name'          => $name !== '' ? $name : null,
            'cart_data'     => $cart_data,
            'last_activity' => $now,
            'qtdTotal'      => $qtd_total,
        ];
        $formats = [ '%d', '%s', '%s', '%s', '%s', '%s', '%d' ];

        if ( $existing_id ) {
            $wpdb->update(
                $table,
                $data,
                [ 'id' => $existing_id ],
                $formats,
                [ '%d' ]
            );
        } else {
            $wpdb->insert( $table, $data, $formats );
        }

        return rest_ensure_response( [
            'success'   => true,
            'qtd_total' => $qtd_total,
        ] );
    }

    /**
     * GET /biju/v1/cart
     * Requer autenticação (JWT). Devolve o carrinho salvo do usuário a partir de
     * wc_abandoned_carts, com cada item HIDRATADO no formato Product que o front
     * consome (preço, imagens, estoque, variações). Permite que o cliente recupere
     * o carrinho ao logar em qualquer navegador.
     *
     * Resposta: { items: [ { product, quantity, variationId?, unitPrice? } ] }
     * Itens cujo produto não existe mais / saiu de catálogo são omitidos.
     */
    public static function get_saved( WP_REST_Request $request ) {
        $user_id = (int) Biju_Auth::get_user_from_request( $request );
        if ( $user_id <= 0 ) {
            return new WP_Error( 'unauthorized', 'Token inválido.', [ 'status' => 401 ] );
        }

        global $wpdb;
        $table = self::table();
        $row   = $wpdb->get_var( $wpdb->prepare(
            "SELECT cart_data FROM {$table} WHERE user_id = %d LIMIT 1",
            $user_id
        ) );

        if ( ! $row ) {
            return rest_ensure_response( [ 'items' => [] ] );
        }

        return rest_ensure_response( [ 'items' => self::hydrate_cart_data( $row ) ] );
    }

    /**
     * GET /biju/v1/cart/recover?token=XXX
     *
     * Público. Troca um token de recuperação (gerado no admin pelo botão
     * "Enviar pro carrinho") pelos itens do carrinho daquele cliente, já
     * hidratados no formato Product que o front consome. Não exige login —
     * o token é o segredo. O front injeta os itens no carrinho e abre o drawer.
     *
     * Resposta: { items: [...], name?, found: bool }
     */
    public static function recover( WP_REST_Request $request ) {
        $token = sanitize_text_field( (string) $request->get_param( 'token' ) );
        if ( $token === '' ) {
            return new WP_Error( 'missing_token', 'Token ausente.', [ 'status' => 400 ] );
        }

        // O token aponta para o id do carrinho (transient curto, single-use-ish).
        $cart_id = (int) get_transient( 'biju_cart_recover_' . $token );
        if ( ! $cart_id ) {
            return new WP_Error( 'invalid_token', 'Link expirado ou inválido.', [ 'status' => 404 ] );
        }

        global $wpdb;
        $table = self::table();
        $row   = $wpdb->get_row( $wpdb->prepare(
            "SELECT cart_data, name FROM {$table} WHERE id = %d LIMIT 1",
            $cart_id
        ) );

        if ( ! $row ) {
            return rest_ensure_response( [ 'items' => [], 'found' => false ] );
        }

        return rest_ensure_response( [
            'items' => self::hydrate_cart_data( $row->cart_data ),
            'name'  => $row->name ?: null,
            'found' => true,
        ] );
    }

    /**
     * Hidrata o cart_data serializado para o array de itens no formato Product
     * que o front consome. Compartilhado por get_saved (logado) e recover (token).
     * Itens cujo produto não existe mais / saiu de catálogo são omitidos.
     *
     * @param string $cart_data conteúdo serializado da coluna cart_data.
     * @return array<int,array>
     */
    private static function hydrate_cart_data( $cart_data ): array {
        $stored = maybe_unserialize( $cart_data );
        if ( ! is_array( $stored ) || empty( $stored ) ) {
            return [];
        }

        $items = [];
        foreach ( $stored as $entry ) {
            $product_id   = isset( $entry['product_id'] ) ? absint( $entry['product_id'] ) : 0;
            $variation_id = isset( $entry['variation_id'] ) ? absint( $entry['variation_id'] ) : 0;
            $quantity     = isset( $entry['quantity'] ) ? max( 1, absint( $entry['quantity'] ) ) : 1;
            if ( ! $product_id ) continue;

            // Hidrata sempre pelo produto-PAI (o front espera o objeto Product do
            // produto, com a variação referenciada por variationId à parte).
            $product = wc_get_product( $product_id );
            if ( ! $product || 'publish' !== $product->get_status() ) {
                continue; // produto removido/despublicado: omite do carrinho
            }

            // Preço unitário da linha: se houver variação, tenta o preço dela.
            $unit_price = (float) $product->get_price();
            $variation  = null;
            if ( $variation_id ) {
                $variation = wc_get_product( $variation_id );
                if ( $variation ) {
                    $unit_price = (float) $variation->get_price();
                }
            }

            // FILTRO DE ESTOQUE: não recupera item esgotado. A encomenda está
            // desligada na loja, então trazer de volta um produto sem estoque só
            // frustraria o cliente (ou geraria estoque negativo se ele fechasse).
            // Quem manda no estoque é a VARIAÇÃO quando existe; senão, o produto.
            // Revalidado aqui (não no momento em que o carrinho foi salvo) porque
            // o link pode ser aberto dias depois. Cobre tanto o link de
            // recuperação quanto o carrinho salvo lido no login.
            $stock_ref = $variation ?: $product;
            if ( ! $stock_ref->is_in_stock() || ! $stock_ref->has_enough_stock( $quantity ) ) {
                continue;
            }

            // 'full' garante que variações venham populadas (necessário para
            // o front resolver preço/estoque da variação selecionada).
            $formatted = Biju_Products::format_product( $product, 'full' );

            $items[] = [
                'product'     => $formatted,
                'quantity'    => $quantity,
                'variationId' => $variation_id ?: null,
                'unitPrice'   => $unit_price,
            ];
        }

        return $items;
    }

    /**
     * DELETE /biju/v1/cart/save
     * Body opcional: { email?, phone? } — para guest poder limpar o próprio registro.
     */
    public static function delete( WP_REST_Request $request ) {
        $user_id = (int) Biju_Auth::get_user_from_request( $request );
        $email   = sanitize_email( (string) $request->get_param( 'email' ) );
        $phone   = self::normalize_phone( (string) $request->get_param( 'phone' ) );

        if ( $user_id <= 0 && $email === '' && $phone === '' ) {
            return rest_ensure_response( [ 'success' => true, 'skipped' => 'no_identifier' ] );
        }

        self::delete_for( $user_id, $email, $phone );
        return rest_ensure_response( [ 'success' => true ] );
    }

    /**
     * Procura registro existente, em ordem de prioridade:
     *  1. user_id (logado)
     *  2. email
     *  3. phone
     */
    private static function find_existing_id( int $user_id, string $email, string $phone ): ?int {
        global $wpdb;
        $table = self::table();

        if ( $user_id > 0 ) {
            $id = $wpdb->get_var( $wpdb->prepare(
                "SELECT id FROM {$table} WHERE user_id = %d LIMIT 1", $user_id
            ) );
            if ( $id ) return (int) $id;
        }
        if ( $email !== '' ) {
            $id = $wpdb->get_var( $wpdb->prepare(
                "SELECT id FROM {$table} WHERE email = %s LIMIT 1", $email
            ) );
            if ( $id ) return (int) $id;
        }
        if ( $phone !== '' ) {
            $id = $wpdb->get_var( $wpdb->prepare(
                "SELECT id FROM {$table} WHERE phone = %s LIMIT 1", $phone
            ) );
            if ( $id ) return (int) $id;
        }
        return null;
    }

    public static function delete_for( int $user_id, string $email = '', string $phone = '' ): void {
        global $wpdb;
        $table = self::table();
        if ( $user_id > 0 ) {
            $wpdb->delete( $table, [ 'user_id' => $user_id ], [ '%d' ] );
        }
        if ( $email !== '' ) {
            $wpdb->delete( $table, [ 'email' => $email ], [ '%s' ] );
        }
        if ( $phone !== '' ) {
            $wpdb->delete( $table, [ 'phone' => $phone ], [ '%s' ] );
        }
    }

    private static function normalize_phone( string $phone ): string {
        $digits = preg_replace( '/\D/', '', $phone );
        return $digits ?: '';
    }

    /**
     * Quando um pedido é pago (processing/completed), limpa o carrinho abandonado
     * por user_id, email ou phone (cobre guests também).
     */
    public static function on_order_paid( $order_id, $old_status, $new_status, $order ) {
        if ( ! $order instanceof WC_Order ) {
            $order = wc_get_order( $order_id );
        }
        if ( ! $order ) return;
        if ( ! in_array( $new_status, [ 'processing', 'completed' ], true ) ) return;

        $user_id = (int) $order->get_user_id();
        $email   = sanitize_email( $order->get_billing_email() );
        $phone   = self::normalize_phone( $order->get_billing_phone() );

        self::delete_for( $user_id, $email, $phone );
    }
}

add_action(
    'woocommerce_order_status_changed',
    [ 'Biju_Abandoned_Cart', 'on_order_paid' ],
    10,
    4
);
