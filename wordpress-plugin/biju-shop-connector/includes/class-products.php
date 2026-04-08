<?php
defined( 'ABSPATH' ) || exit;

/**
 * Handlers de produtos — converte dados WooCommerce para o formato do frontend.
 */
class Biju_Products {

    /**
     * GET /biju/v1/products
     */
    public static function get_products( WP_REST_Request $request ): WP_REST_Response {
        $args = [
            'status'         => 'publish',
            'limit'          => (int) ( $request->get_param( 'per_page' ) ?? 20 ),
            'page'           => (int) ( $request->get_param( 'page' ) ?? 1 ),
            'orderby'        => $request->get_param( 'orderby' ) ?? 'date',
            'order'          => $request->get_param( 'order' ) ?? 'DESC',
        ];

        // Filtro por categoria
        $category = $request->get_param( 'category' );
        if ( $category ) {
            $args['category'] = [ sanitize_text_field( $category ) ];
        }

        // Busca textual
        $search = $request->get_param( 'search' );
        if ( $search ) {
            $args['s'] = sanitize_text_field( $search );
        }

        // Filtro em destaque
        if ( $request->get_param( 'featured' ) ) {
            $args['featured'] = true;
        }

        $products   = wc_get_products( $args );
        $total      = (int) ( new WC_Product_Query( array_merge( $args, [ 'return' => 'ids', 'limit' => -1 ] ) ) )->get_products();
        $total      = is_array( $total ) ? count( $total ) : 0;
        $total_pages = ceil( $total / $args['limit'] );

        $data = array_map( [ __CLASS__, 'format_product' ], $products );

        $response = new WP_REST_Response( $data, 200 );
        $response->header( 'X-WP-Total', $total );
        $response->header( 'X-WP-TotalPages', $total_pages );

        return $response;
    }

    /**
     * GET /biju/v1/products/{id}
     */
    public static function get_product( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $id      = (int) $request->get_param( 'id' );
        $product = wc_get_product( $id );

        if ( ! $product || 'publish' !== $product->get_status() ) {
            return new WP_Error( 'not_found', 'Produto não encontrado.', [ 'status' => 404 ] );
        }

        return new WP_REST_Response( self::format_product( $product ), 200 );
    }

    /**
     * GET /biju/v1/categories
     */
    public static function get_categories( WP_REST_Request $request ): WP_REST_Response {
        $terms = get_terms( [
            'taxonomy'   => 'product_cat',
            'hide_empty' => true,
            'orderby'    => 'name',
        ] );

        if ( is_wp_error( $terms ) ) {
            return new WP_REST_Response( [], 200 );
        }

        $data = array_map( function ( WP_Term $term ) {
            $thumb_id  = get_term_meta( $term->term_id, 'thumbnail_id', true );
            $thumb_url = $thumb_id ? wp_get_attachment_url( $thumb_id ) : null;

            return [
                'id'    => $term->term_id,
                'name'  => $term->name,
                'slug'  => $term->slug,
                'count' => $term->count,
                'image' => $thumb_url,
            ];
        }, $terms );

        return new WP_REST_Response( $data, 200 );
    }

    // -------------------------------------------------------------------------
    // Formato de saída compatível com o frontend React
    // -------------------------------------------------------------------------

    public static function format_product( WC_Product $product ): array {
        $images = array_values( array_filter( array_map( function ( $img ) {
            return wp_get_attachment_url( $img['id'] ?? 0 ) ?: null;
        }, $product->get_gallery_image_ids() ) ) );

        // Inclui a imagem principal na frente
        $main_image = wp_get_attachment_url( $product->get_image_id() );
        if ( $main_image ) {
            array_unshift( $images, $main_image );
        }

        // Atributos
        $colors   = [];
        $material = '';
        foreach ( $product->get_attributes() as $attr ) {
            $name = is_object( $attr ) ? $attr->get_name() : $attr['name'] ?? '';
            $name_lower = strtolower( $name );
            $values = is_object( $attr ) ? $attr->get_options() : (array) ( $attr['options'] ?? [] );

            if ( str_contains( $name_lower, 'cor' ) || str_contains( $name_lower, 'color' ) ) {
                foreach ( $values as $v ) {
                    $colors[] = is_int( $v ) ? get_term( $v )->name : $v;
                }
            }
            if ( str_contains( $name_lower, 'material' ) ) {
                $material = implode( ', ', array_map( fn( $v ) => is_int( $v ) ? get_term( $v )->name : $v, $values ) );
            }
        }

        // Badge
        $badge = null;
        if ( $product->is_on_sale() ) $badge = 'Oferta';
        elseif ( $product->is_featured() ) $badge = 'Destaque';

        // Categoria principal
        $cat_ids = $product->get_category_ids();
        $category = '';
        if ( ! empty( $cat_ids ) ) {
            $term = get_term( $cat_ids[0], 'product_cat' );
            $category = $term instanceof WP_Term ? $term->name : '';
        }

        $regular = (float) ( $product->get_regular_price() ?: $product->get_price() );
        $sale    = (float) $product->get_sale_price();

        return [
            'id'            => (string) $product->get_id(),
            'name'          => $product->get_name(),
            'price'         => (float) $product->get_price(),
            'originalPrice' => $sale && $regular > $sale ? $regular : null,
            'description'   => wp_strip_all_tags( $product->get_description() ?: $product->get_short_description() ),
            'shortDescription' => wp_strip_all_tags( $product->get_short_description() ),
            'category'      => $category,
            'images'        => $images ?: [ wc_placeholder_img_src() ],
            'badge'         => $badge,
            'rating'        => (float) $product->get_average_rating(),
            'reviews'       => (int) $product->get_review_count(),
            'material'      => $material,
            'colors'        => $colors,
            'inStock'       => $product->is_in_stock(),
            'slug'          => $product->get_slug(),
            'sku'           => $product->get_sku(),
            'stockQuantity' => $product->get_stock_quantity(),
        ];
    }
}
