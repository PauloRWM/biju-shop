<?php
defined( 'ABSPATH' ) || exit;

/**
 * Faz a edição em massa / edição rápida da LISTA de produtos funcionar para
 * produtos VARIÁVEIS.
 *
 * No WooCommerce, o preço de um produto variável não fica no produto-pai — fica
 * em cada variação. O bulk/quick edit da listagem altera o pai, que ignora preço.
 * Resultado: para variável, "atualiza" mas nada muda.
 *
 * Esta classe escuta os hooks de save do bulk/quick edit e, quando o produto é
 * variável, aplica a mesma mudança de preço solicitada em TODAS as variações
 * (replicando os modos do Woo: definir / aumentar / diminuir, valor ou %).
 * Depois ressincroniza o pai para a listagem refletir o novo valor.
 *
 * O `_price` ativo de cada variação é sincronizado por Biju_Price_Sync (hook
 * woocommerce_update_product_variation), disparado no save de cada variação.
 */
class Biju_Variation_Bulk_Price {

    /** Arquivo de log de diagnóstico (temporário). */
    const LOG = WP_CONTENT_DIR . '/biju-bulk-debug.log';

    public static function init(): void {
        // Sniffer: registra a requisição admin que parece bulk/quick edit de preço,
        // ANTES dos hooks do Woo — prova que o POST chegou mesmo que o hook não dispare.
        add_action( 'admin_init', [ __CLASS__, 'log_admin_request' ], 1 );

        // Loggers "sempre disparam" (prio 1) — provam se o hook foi chamado.
        add_action( 'woocommerce_product_quick_edit_save', [ __CLASS__, 'log_quick_fired' ], 1 );
        add_action( 'woocommerce_product_bulk_edit_save',  [ __CLASS__, 'log_bulk_fired' ],  1 );

        // Propagação para variações (prio 20).
        add_action( 'woocommerce_product_quick_edit_save', [ __CLASS__, 'on_quick_edit' ], 20 );
        add_action( 'woocommerce_product_bulk_edit_save',  [ __CLASS__, 'on_bulk_edit' ],  20 );
    }

    /** Escreve uma linha no log de diagnóstico. */
    public static function log( string $msg ): void {
        $line = '[' . gmdate( 'Y-m-d H:i:s' ) . " UTC] $msg\n";
        @file_put_contents( self::LOG, $line, FILE_APPEND | LOCK_EX );
    }

    /** Resumo dos campos de preço relevantes no request. */
    private static function price_fields_summary(): string {
        $req  = self::request_data();
        $keys = [ 'change_regular_price', '_regular_price', 'change_sale_price', '_sale_price', 'woocommerce_quick_edit', 'woocommerce_bulk_edit', 'action', 'bulk_action' ];
        $out  = [];
        foreach ( $keys as $k ) {
            $out[] = $k . '=' . ( isset( $req[ $k ] ) ? '"' . ( is_scalar( $req[ $k ] ) ? $req[ $k ] : wp_json_encode( $req[ $k ] ) ) . '"' : '(ausente)' );
        }
        $out[] = 'uri=' . ( $_SERVER['REQUEST_URI'] ?? '?' );
        $out[] = 'doing_ajax=' . ( ( defined( 'DOING_AJAX' ) && DOING_AJAX ) ? '1' : '0' );
        return implode( ' | ', $out );
    }

    /** Loga a requisição admin se parecer bulk/quick edit (mesmo que o hook do Woo não dispare). */
    public static function log_admin_request(): void {
        $req = self::request_data();
        $looks_bulk  = isset( $req['bulk_edit'] ) || isset( $req['change_regular_price'] ) || isset( $req['change_sale_price'] );
        $looks_quick = isset( $req['woocommerce_quick_edit'] ) || ( isset( $req['action'] ) && 'inline-save' === $req['action'] );
        if ( ! $looks_bulk && ! $looks_quick ) {
            return;
        }
        $posts = $req['post'] ?? ( $req['post_ID'] ?? '' );
        $ids   = is_array( $posts ) ? implode( ',', array_map( 'intval', $posts ) ) : (string) $posts;
        self::log( '--- ADMIN_REQUEST (' . ( $looks_bulk ? 'BULK' : 'QUICK' ) . ") post_ids=[$ids] :: " . self::price_fields_summary() );
    }

    public static function log_bulk_fired( $product ): void {
        $id   = ( $product instanceof WC_Product ) ? $product->get_id() : 0;
        $type = ( $product instanceof WC_Product ) ? $product->get_type() : 'n/a';
        self::log( "BULK_HOOK_FIRED id=$id type=$type :: " . self::price_fields_summary() );
    }

    public static function log_quick_fired( $product ): void {
        $id   = ( $product instanceof WC_Product ) ? $product->get_id() : 0;
        $type = ( $product instanceof WC_Product ) ? $product->get_type() : 'n/a';
        self::log( "QUICK_HOOK_FIRED id=$id type=$type :: " . self::price_fields_summary() );
    }

    /** Lê o array de requisição (mesma fonte que o WooCommerce usa no admin). */
    private static function request_data(): array {
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        return isset( $_REQUEST ) ? wp_unslash( $_REQUEST ) : [];
    }

    /**
     * Edição rápida: preços absolutos em _regular_price / _sale_price.
     * (Para variável o Woo costuma esconder o campo, mas tratamos se vier.)
     */
    public static function on_quick_edit( $product ): void {
        if ( ! ( $product instanceof WC_Product ) || ! $product->is_type( 'variable' ) ) {
            return;
        }
        $req     = self::request_data();
        $changed = false;

        if ( isset( $req['_regular_price'] ) && '' !== $req['_regular_price'] ) {
            $val = wc_format_decimal( $req['_regular_price'] );
            $changed = self::apply_to_variations( $product, 'regular', 1, $val ) || $changed;
        }
        if ( isset( $req['_sale_price'] ) ) {
            $val = ( '' === $req['_sale_price'] ) ? '' : wc_format_decimal( $req['_sale_price'] );
            $changed = self::apply_to_variations( $product, 'sale', 1, $val ) || $changed;
        }

        if ( $changed ) {
            self::resync_parent( $product );
        }
    }

    /**
     * Edição em massa: modos change_*_price (1=definir, 2=aumentar, 3=diminuir,
     * 4=preço normal menos X — só sale), valor podendo ser percentual ("10%").
     */
    public static function on_bulk_edit( $product ): void {
        if ( ! ( $product instanceof WC_Product ) ) {
            self::log( 'BULK_PROPAGATE skip: product nao e WC_Product' );
            return;
        }
        if ( ! $product->is_type( 'variable' ) ) {
            self::log( 'BULK_PROPAGATE skip: id=' . $product->get_id() . ' nao e variavel (type=' . $product->get_type() . ')' );
            return;
        }
        $req     = self::request_data();
        $changed = false;

        foreach ( [ 'regular', 'sale' ] as $type ) {
            if ( empty( $req[ "change_{$type}_price" ] ) || ! isset( $req[ "_{$type}_price" ] ) ) {
                self::log( "BULK_PROPAGATE id={$product->get_id()} type=$type: SEM mudanca (change_{$type}_price=" . ( $req[ "change_{$type}_price" ] ?? 'ausente' ) . ", _{$type}_price " . ( isset( $req["_{$type}_price"] ) ? 'presente' : 'ausente' ) . ')' );
                continue;
            }
            $mode = (int) $req[ "change_{$type}_price" ];
            $raw  = (string) $req[ "_{$type}_price" ];
            self::log( "BULK_PROPAGATE id={$product->get_id()} aplicando type=$type mode=$mode raw=\"$raw\" em " . count( $product->get_children() ) . ' variacoes' );
            $changed = self::apply_to_variations( $product, $type, $mode, $raw ) || $changed;
        }

        self::log( "BULK_PROPAGATE id={$product->get_id()} resultado: " . ( $changed ? 'ALTEROU variacoes -> resync pai' : 'NENHUMA variacao alterada' ) );
        if ( $changed ) {
            self::resync_parent( $product );
        }
    }

    /**
     * Aplica a mudança de preço a todas as variações do produto.
     *
     * @param WC_Product $product Produto variável (pai).
     * @param string     $type    'regular' ou 'sale'.
     * @param int        $mode    1=definir, 2=aumentar, 3=diminuir, 4=normal menos X (sale).
     * @param string     $raw     Valor digitado (pode conter '%').
     * @return bool true se alguma variação mudou.
     */
    private static function apply_to_variations( WC_Product $product, string $type, int $mode, string $raw ): bool {
        $is_percentage = false !== strpos( $raw, '%' );
        $value         = wc_format_decimal( $raw );
        $decimals      = wc_get_price_decimals();
        $any           = false;

        foreach ( $product->get_children() as $vid ) {
            $variation = wc_get_product( $vid );
            if ( ! $variation ) {
                continue;
            }

            // Lê preços direto do meta para evitar filtros de moeda (Multi-Currency).
            $old_regular = get_post_meta( $vid, '_regular_price', true );
            $old_sale    = get_post_meta( $vid, '_sale_price', true );
            $old         = ( 'sale' === $type ) ? $old_sale : $old_regular;
            $old_num     = ( '' === $old || null === $old )
                ? (float) ( '' === $old_regular ? 0 : $old_regular )
                : (float) $old;

            $new = null;

            switch ( $mode ) {
                case 1: // Definir como
                    if ( '' === $raw ) {
                        // sale vazio = remover promoção; regular vazio não faz sentido (ignora)
                        $new = ( 'sale' === $type ) ? '' : null;
                    } else {
                        $new = $value;
                    }
                    break;

                case 2: // Aumentar
                    if ( $is_percentage ) {
                        $new = $old_num + ( $old_num * ( (float) $value / 100 ) );
                    } elseif ( '' !== $value ) {
                        $new = $old_num + (float) $value;
                    }
                    break;

                case 3: // Diminuir
                    if ( $is_percentage ) {
                        $new = max( 0, $old_num - ( $old_num * ( (float) $value / 100 ) ) );
                    } elseif ( '' !== $value ) {
                        $new = max( 0, $old_num - (float) $value );
                    }
                    break;

                case 4: // (só sale) preço normal menos X
                    if ( 'sale' !== $type ) {
                        break;
                    }
                    $reg = (float) ( '' === $old_regular ? 0 : $old_regular );
                    if ( $is_percentage ) {
                        $new = max( 0, $reg - ( $reg * ( (float) $value / 100 ) ) );
                    } else {
                        $new = max( 0, $reg - (float) $value );
                    }
                    break;
            }

            if ( null === $new ) {
                self::log( "  var $vid type=$type: new=null (modo nao produziu valor) — pula" );
                continue;
            }

            $new_str = ( '' === $new ) ? '' : wc_format_decimal( round( (float) $new, $decimals ) );
            if ( (string) $new_str === (string) $old ) {
                self::log( "  var $vid type=$type: novo($new_str) == antigo($old) — sem mudanca" );
                continue;
            }

            if ( 'sale' === $type ) {
                $variation->set_sale_price( $new_str );
            } else {
                $variation->set_regular_price( $new_str );
            }
            $variation->save(); // dispara woocommerce_update_product_variation -> Biju_Price_Sync ajusta _price
            self::log( "  var $vid type=$type: GRAVOU antigo=$old novo=$new_str" );
            $any = true;
        }

        return $any;
    }

    /**
     * Ressincroniza o produto-pai (faixa de preço / _price exibido na lista) e
     * invalida o cache de catálogo para o front headless refletir na hora.
     */
    private static function resync_parent( WC_Product $product ): void {
        $pid = $product->get_id();

        if ( class_exists( 'WC_Product_Variable' ) ) {
            WC_Product_Variable::sync( $pid );
        }
        if ( function_exists( 'wc_delete_product_transients' ) ) {
            wc_delete_product_transients( $pid );
        }
        if ( class_exists( 'Biju_Cache' ) ) {
            Biju_Cache::bump_version();
        }
    }
}
