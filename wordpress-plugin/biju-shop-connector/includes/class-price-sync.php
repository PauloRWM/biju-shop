<?php
defined( 'ABSPATH' ) || exit;

/**
 * Sincroniza o preço ATIVO (_price) a partir de _regular_price / _sale_price.
 *
 * Neste site, vários produtos foram importados só com `_price` (sem `_regular_price`),
 * e a sincronização nativa do WooCommerce (regular -> preço ativo) não está propagando
 * no save. Resultado: editar preço pelo bulk edit / edição rápida grava `_regular_price`
 * mas o `_price` (valor que o front headless e o checkout usam) fica preso no antigo.
 *
 * Esta classe recalcula `_price` a partir de regular/sale (com janela de promoção) e
 * grava direto no meta a cada save de produto/variação — garantindo que o preço editado
 * realmente vá ao ar.
 */
class Biju_Price_Sync {

    public static function init(): void {
        add_action( 'woocommerce_update_product',           [ __CLASS__, 'sync' ], 20 );
        add_action( 'woocommerce_update_product_variation', [ __CLASS__, 'sync' ], 20 );
    }

    /**
     * Recalcula e grava `_price` para um produto/variação.
     *
     * @param int $product_id ID do produto ou variação.
     */
    public static function sync( $product_id ): void {
        $product_id = (int) $product_id;
        if ( $product_id <= 0 ) {
            return;
        }

        $regular = get_post_meta( $product_id, '_regular_price', true );

        // Sem preço normal confiável: não mexe (evita zerar produto importado só com _price).
        if ( '' === $regular || null === $regular ) {
            return;
        }

        $active = self::active_price( $product_id, $regular );

        $current = get_post_meta( $product_id, '_price', true );
        if ( (string) $current !== (string) $active ) {
            update_post_meta( $product_id, '_price', $active );
            wp_cache_delete( $product_id, 'post_meta' );
            wp_cache_delete( 'product-' . $product_id, 'products' );
        }
    }

    /**
     * Preço ativo: sale price se houver promoção vigente, senão o preço normal.
     *
     * @param int    $product_id ID do produto/variação.
     * @param string $regular    Preço normal já lido do meta.
     * @return string
     */
    private static function active_price( int $product_id, string $regular ): string {
        $sale = get_post_meta( $product_id, '_sale_price', true );
        if ( '' === $sale || null === $sale ) {
            return $regular;
        }

        $now  = current_time( 'timestamp', true );
        $from = (int) get_post_meta( $product_id, '_sale_price_dates_from', true );
        $to   = (int) get_post_meta( $product_id, '_sale_price_dates_to', true );

        if ( $from && $now < $from ) {
            return $regular; // promoção ainda não começou
        }
        if ( $to && $now > $to ) {
            return $regular; // promoção já terminou
        }

        return $sale;
    }
}
