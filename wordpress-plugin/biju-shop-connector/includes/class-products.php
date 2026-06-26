<?php
defined( 'ABSPATH' ) || exit;

/**
 * Handlers de produtos — converte dados WooCommerce para o formato do frontend.
 */
class Biju_Products {

    /** TTL do cache de listagem/detalhe de produtos (segundos). */
    const PRODUCTS_TTL   = 5 * MINUTE_IN_SECONDS;
    /** TTL do cache de categorias (mudam raramente). */
    const CATEGORIES_TTL = 15 * MINUTE_IN_SECONDS;

    /**
     * GET /biju/v1/products
     */
    public static function get_products( WP_REST_Request $request ): WP_REST_Response {
        $args = [
            'status'  => 'publish',
            'limit'   => (int) ( $request->get_param( 'per_page' ) ?? 20 ),
            'page'    => (int) ( $request->get_param( 'page' ) ?? 1 ),
            'orderby' => $request->get_param( 'orderby' ) ?? 'date',
            'order'   => $request->get_param( 'order' ) ?? 'DESC',
        ];

        // Filtro por categoria — aceita slug ou nome do termo
        $category = $request->get_param( 'category' );
        if ( $category ) {
            $cat_val = sanitize_text_field( $category );
            // Primeiro tenta por slug (caminho rápido), depois por nome (fallback).
            $term = get_term_by( 'slug', $cat_val, 'product_cat' );
            if ( ! $term instanceof WP_Term ) {
                $term = get_term_by( 'name', $cat_val, 'product_cat' );
            }
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

        // Resposta cacheada por combinação de parâmetros + versão do cache.
        // Buscas textuais não são cacheadas (resultado muito variável / baixo reuso).
        $compute = function () use ( $args ) {
            // 'paginate' => true devolve total e max_num_pages numa única query,
            // eliminando a antiga query "fantasma" com limit => -1 só para contar.
            $result = wc_get_products( array_merge( $args, [ 'paginate' => true ] ) );
            $products    = $result->products ?? [];
            $total       = (int) ( $result->total ?? 0 );
            $total_pages = (int) ( $result->max_num_pages ?? 0 );

            self::prime_caches( $products );

            $data = array_map(
                fn( WC_Product $p ) => self::format_product( $p, 'list' ),
                $products
            );

            return [ 'data' => $data, 'total' => $total, 'total_pages' => $total_pages ];
        };

        if ( empty( $args['s'] ) ) {
            $cache_key = 'products|' . wp_json_encode( $args );
            $payload   = Biju_Cache::remember( $cache_key, self::PRODUCTS_TTL, $compute );
        } else {
            $payload = $compute();
        }

        $response = new WP_REST_Response( $payload['data'], 200 );
        $response->header( 'X-WP-Total', $payload['total'] );
        $response->header( 'X-WP-TotalPages', $payload['total_pages'] );
        self::cache_headers( $response );

        return $response;
    }

    /**
     * Pré-aquece os caches de posts/metadados/termos/imagens em LOTE, para que a
     * serialização de cada produto (format_product) acerte o object cache em vez
     * de disparar uma query por produto/imagem (problema N+1).
     *
     * @param WC_Product[] $products
     */
    private static function prime_caches( array $products ): void {
        if ( empty( $products ) ) return;

        $product_ids = array_map( fn( $p ) => $p->get_id(), $products );

        // Posts + metadados dos produtos e termos (categorias/atributos)
        _prime_post_caches( $product_ids, true, true );
        update_object_term_cache( $product_ids, 'product' );

        // Imagens (principal + galeria) de todos os produtos de uma vez
        $image_ids = [];
        foreach ( $products as $p ) {
            $main = (int) $p->get_image_id();
            if ( $main ) $image_ids[] = $main;
            foreach ( (array) $p->get_gallery_image_ids() as $gid ) {
                $image_ids[] = (int) $gid;
            }
        }
        $image_ids = array_values( array_unique( array_filter( $image_ids ) ) );
        if ( ! empty( $image_ids ) ) {
            _prime_post_caches( $image_ids, false, true );
        }
    }

    /**
     * Headers HTTP para que browser e CDN/proxy possam cachear rotas públicas.
     */
    private static function cache_headers( WP_REST_Response $response, int $max_age = 60, int $s_max_age = 300 ): void {
        $response->header(
            'Cache-Control',
            "public, max-age={$max_age}, s-maxage={$s_max_age}, stale-while-revalidate=600"
        );
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

        // Detalhe (contexto 'full': inclui variações e descrição completa).
        $data = Biju_Cache::remember(
            "product|{$id}",
            self::PRODUCTS_TTL,
            fn() => self::format_product( $product, 'full' )
        );

        $response = new WP_REST_Response( $data, 200 );
        self::cache_headers( $response );
        return $response;
    }

    /**
     * GET /biju/v1/categories
     */
    public static function get_categories( WP_REST_Request $request ): WP_REST_Response {
        $data = Biju_Cache::remember( 'categories', self::CATEGORIES_TTL, function () {
            $terms = get_terms( [
                'taxonomy'   => 'product_cat',
                'hide_empty' => true,
                'orderby'    => 'name',
            ] );

            if ( is_wp_error( $terms ) ) {
                return [];
            }

            // array_values garante chaves sequenciais 0..n-1. Sem isso, qualquer
            // buraco no array (ex.: term filtrado/removido) faz o json_encode
            // serializar como OBJETO {...} em vez de ARRAY [...], e o frontend
            // (Array.isArray) descarta a resposta e cai no fallback hardcoded.
            return array_values( array_map( function ( WP_Term $term ) {
                $thumb_id  = get_term_meta( $term->term_id, 'thumbnail_id', true );
                $thumb_url = $thumb_id ? wp_get_attachment_url( $thumb_id ) : null;

                return [
                    'id'    => $term->term_id,
                    'name'  => $term->name,
                    'slug'  => $term->slug,
                    // $term->count já reflete só produtos publicados (WooCommerce
                    // mantém a contagem via _wc_term_recount). Antes isso disparava
                    // uma query limit => -1 por categoria (N+1).
                    'count' => (int) $term->count,
                    'image' => $thumb_url,
                ];
            }, $terms ) );
        } );

        $response = new WP_REST_Response( $data, 200 );
        self::cache_headers( $response );
        return $response;
    }

    // -------------------------------------------------------------------------
    // Formato de saída compatível com o frontend React
    // -------------------------------------------------------------------------

    /**
     * @param string $context 'list' (grade — payload enxuto, sem variações nem
     *                          descrição longa) ou 'full' (detalhe do produto).
     */
    public static function format_product( WC_Product $product, string $context = 'full' ): array {
        $is_full = ( 'full' === $context );
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

        // Monta o srcset do card (1x/2x) a partir dos tamanhos dedicados
        // 'biju_card' (360w) e 'biju_card_2x' (540w). Faz fallback ao thumb
        // do Woo se o tamanho ainda não tiver sido gerado, para nunca quebrar.
        $build_srcset = function ( int $id ) use ( $resolve_image ): ?string {
            if ( ! $id ) return null;
            $s1 = $resolve_image( $id, 'biju_card' );
            $s2 = $resolve_image( $id, 'biju_card_2x' );
            $parts = [];
            if ( $s1 ) $parts[] = $s1 . ' 360w';
            if ( $s2 ) $parts[] = $s2 . ' 540w';
            return $parts ? implode( ', ', $parts ) : null;
        };
        $images_srcset = array_values( array_filter( array_map(
            fn( $id ) => $build_srcset( (int) $id ),
            $gallery_ids
        ) ) );

        // Inclui a imagem principal na frente
        $main_id     = (int) $product->get_image_id();
        $main_large  = $resolve_image( $main_id, 'large' );
        $main_thumb  = $resolve_image( $main_id, 'woocommerce_thumbnail' );
        $main_srcset = $build_srcset( $main_id );
        if ( $main_large )  array_unshift( $images, $main_large );
        if ( $main_thumb )  array_unshift( $images_thumb, $main_thumb );
        if ( $main_srcset ) array_unshift( $images_srcset, $main_srcset );

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

        // Variações: get_available_variations() é caro (carrega cada variação como
        // produto completo). Só materializa no detalhe ('full'); na listagem o card
        // só precisa de 'type' para saber que é variável.
        $variations_out = [];
        if ( $is_full && $product->is_type( 'variable' ) && method_exists( $product, 'get_available_variations' ) ) {
            foreach ( $product->get_available_variations() as $v ) {
                $vimg = $v['image']['src'] ?? ( $v['image']['url'] ?? '' );
                $variations_out[] = [
                    'id'         => (int) ( $v['variation_id'] ?? 0 ),
                    'attributes' => array_map( 'strval', (array) ( $v['attributes'] ?? [] ) ),
                    'price'      => isset( $v['display_price'] ) ? (float) $v['display_price'] : 0.0,
                    'regularPrice' => isset( $v['display_regular_price'] ) ? (float) $v['display_regular_price'] : 0.0,
                    'inStock'    => ! empty( $v['is_in_stock'] ),
                    'stockQuantity' => isset( $v['max_qty'] ) && $v['max_qty'] !== ''
                        ? (int) $v['max_qty']
                        : null,
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
            // Descrição longa só no detalhe; na listagem reduz o payload.
            'description'   => $is_full
                ? wp_strip_all_tags( $product->get_description() ?: $product->get_short_description() )
                : wp_strip_all_tags( $product->get_short_description() ),
            'shortDescription' => wp_strip_all_tags( $product->get_short_description() ),
            'category'      => $category,
            'images'        => $images ?: [ wc_placeholder_img_src() ],
            'images_thumb'  => $images_thumb ?: ( $images ?: [ wc_placeholder_img_src() ] ),
            'images_srcset' => $images_srcset, // srcset 1x/2x p/ o card (pode ser [] em fallback)
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
