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

        // Filtro por categoria — aceita slug ou nome do termo
        $category = $request->get_param( 'category' );
        if ( $category ) {
            $cat_val = sanitize_text_field( $category );
            // Primeiro tenta por slug
            $term = get_term_by( 'slug', $cat_val, 'product_cat' );
            // Se não encontrar, tenta por nome
            if ( ! $term instanceof WP_Term ) {
                $term = get_term_by( 'name', $cat_val, 'product_cat' );
            }
            // Só adiciona o filtro se encontrou a categoria
            if ( $term instanceof WP_Term ) {
                $args['category'] = [ $term->slug ];
            }
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

        $products = wc_get_products( $args );

        $count_args = array_merge( $args, [ 'return' => 'ids', 'limit' => -1, 'page' => 1 ] );
        $all_ids    = wc_get_products( $count_args );
        $total      = is_array( $all_ids ) ? count( $all_ids ) : 0;
        $per_page   = max( 1, (int) $args['limit'] );
        $total_pages = (int) ceil( $total / $per_page );

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

            // Contar apenas produtos publicados nesta categoria
            $published_ids = wc_get_products( [
                'status'   => 'publish',
                'category' => [ $term->slug ],
                'return'   => 'ids',
                'limit'    => -1,
            ] );
            $count = is_array( $published_ids ) ? count( $published_ids ) : 0;

            return [
                'id'    => $term->term_id,
                'name'  => $term->name,
                'slug'  => $term->slug,
                'count' => $count,
                'image' => $thumb_url,
            ];
        }, $terms );

        return new WP_REST_Response( $data, 200 );
    }

    // -------------------------------------------------------------------------
    // Formato de saída compatível com o frontend React
    // -------------------------------------------------------------------------

    public static function format_product( WC_Product $product ): array {
        // Usa o tamanho 'large' (~1024px) ao invés do original — mesma percepção
        // visual em desktop/celular, mas 5-10x mais leve. Para thumbs de card/cart,
        // o frontend pode usar images_thumb (woocommerce_thumbnail ~324px).
        $resolve_image = function ( int $id, string $size = 'large' ): ?string {
            if ( ! $id ) return null;
            $src = wp_get_attachment_image_src( $id, $size );
            return $src && ! empty( $src[0] ) ? $src[0] : ( wp_get_attachment_url( $id ) ?: null );
        };

        $gallery_ids = (array) $product->get_gallery_image_ids();
        $images = array_values( array_filter( array_map(
            fn( $id ) => $resolve_image( (int) $id, 'large' ),
            $gallery_ids
        ) ) );
        $images_thumb = array_values( array_filter( array_map(
            fn( $id ) => $resolve_image( (int) $id, 'woocommerce_thumbnail' ),
            $gallery_ids
        ) ) );

        // Inclui a imagem principal na frente
        $main_id    = (int) $product->get_image_id();
        $main_large = $resolve_image( $main_id, 'large' );
        $main_thumb = $resolve_image( $main_id, 'woocommerce_thumbnail' );
        if ( $main_large ) array_unshift( $images, $main_large );
        if ( $main_thumb ) array_unshift( $images_thumb, $main_thumb );

        // Atributos (todos)
        $colors          = [];
        $material        = '';
        $attributes_out  = [];
        $is_variable     = $product->is_type( 'variable' );
        foreach ( $product->get_attributes() as $taxonomy_or_key => $attr ) {
            $name      = is_object( $attr ) ? $attr->get_name() : ( $attr['name'] ?? '' );
            $name_lower = strtolower( $name );
            $values    = is_object( $attr ) ? $attr->get_options() : (array) ( $attr['options'] ?? [] );
            $is_taxonomy = is_object( $attr ) ? $attr->is_taxonomy() : false;
            $for_variation = is_object( $attr ) ? $attr->get_variation() : ! empty( $attr['variation'] );

            $resolved = [];
            $slug_to_label = [];
            foreach ( $values as $v ) {
                if ( $is_taxonomy && ( is_int( $v ) || ctype_digit( (string) $v ) ) ) {
                    $t = get_term( (int) $v, $name );
                    if ( $t instanceof WP_Term ) {
                        $resolved[] = $t->name;
                        $slug_to_label[ $t->slug ] = $t->name;
                    }
                } else {
                    $resolved[] = (string) $v;
                    $slug_to_label[ sanitize_title( (string) $v ) ] = (string) $v;
                }
            }

            if ( str_contains( $name_lower, 'cor' ) || str_contains( $name_lower, 'color' ) || str_contains( $name_lower, 'pa_cor' ) ) {
                foreach ( $resolved as $r ) if ( $r !== '' ) $colors[] = $r;
            }
            if ( str_contains( $name_lower, 'material' ) ) {
                $material = implode( ', ', array_filter( $resolved, fn( $n ) => $n !== '' ) );
            }

            $attributes_out[] = [
                'name'         => $name,
                'label'        => function_exists( 'wc_attribute_label' ) ? wc_attribute_label( $name ) : $name,
                'options'      => array_values( array_filter( $resolved, fn( $n ) => $n !== '' ) ),
                'slug_to_label'=> $slug_to_label,
                'taxonomy'     => $is_taxonomy,
                'variation'    => $is_variable && (bool) $for_variation,
            ];
        }

        // Variações (apenas para produtos do tipo "variable")
        $variations_out = [];
        if ( $product->is_type( 'variable' ) && method_exists( $product, 'get_available_variations' ) ) {
            foreach ( $product->get_available_variations() as $v ) {
                $vimg = $v['image']['src'] ?? ( $v['image']['url'] ?? '' );
                $variations_out[] = [
                    'id'         => (int) ( $v['variation_id'] ?? 0 ),
                    'attributes' => array_map( 'strval', (array) ( $v['attributes'] ?? [] ) ),
                    'price'      => isset( $v['display_price'] ) ? (float) $v['display_price'] : 0.0,
                    'regularPrice' => isset( $v['display_regular_price'] ) ? (float) $v['display_regular_price'] : 0.0,
                    'inStock'    => ! empty( $v['is_in_stock'] ),
                    'image'      => is_string( $vimg ) ? $vimg : '',
                    'sku'        => (string) ( $v['sku'] ?? '' ),
                ];
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
            'images_thumb'  => $images_thumb ?: ( $images ?: [ wc_placeholder_img_src() ] ),
            'has_image'     => ! empty( $images ), // false = caiu no placeholder do Woo
            'badge'         => $badge,
            'rating'        => (float) $product->get_average_rating(),
            'reviews'       => (int) $product->get_review_count(),
            'material'      => $material,
            'colors'        => $colors,
            'inStock'       => $product->is_in_stock(),
            'slug'          => $product->get_slug(),
            'sku'           => $product->get_sku(),
            'stockQuantity' => $product->get_stock_quantity(),
            'type'          => $product->get_type(),
            'attributes'    => $attributes_out,
            'variations'    => $variations_out,
        ];
    }
}
