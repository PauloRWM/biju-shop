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
