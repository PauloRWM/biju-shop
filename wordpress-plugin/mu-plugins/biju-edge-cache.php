<?php
/**
 * Plugin Name: Biju Edge Cache (REST público no Redis, antes do boot dos plugins)
 * Description: Serve as rotas GET públicas de catálogo (products, categories, homepage)
 *              direto do object cache (Redis) ANTES de carregar os ~39 plugins do site.
 *              Num cache HIT, a resposta sai em poucos ms porque o WordPress não chega
 *              a inicializar WooCommerce/Elementor/etc. Invalidação por versão: qualquer
 *              mudança de produto/estoque/categoria incrementa a versão e descarta o cache.
 *
 * INSTALAÇÃO: copiar para wp-content/mu-plugins/biju-edge-cache.php
 *             (mu-plugins carregam sozinhos; precisam ficar na RAIZ dessa pasta).
 *
 * Requer: object cache persistente ativo (plugin "Redis Object Cache" / object-cache.php).
 *         Sem ele, o arquivo simplesmente não faz nada (site funciona normal).
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'BIJU_EDGE_GROUP' ) ) {
    define( 'BIJU_EDGE_GROUP', 'biju_edge' ); // grupo do object cache
    define( 'BIJU_EDGE_TTL', 300 );           // backstop em segundos (além da invalidação por versão)
}

/**
 * A rota é cacheável? Só GET público de catálogo, sem busca e sem login.
 */
function biju_edge_request_info() {
    if ( ( $_SERVER['REQUEST_METHOD'] ?? 'GET' ) !== 'GET' ) {
        return null;
    }
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    if ( strpos( $uri, '/biju/v1/' ) === false ) {
        return null;
    }

    $parts = explode( '?', $uri, 2 );
    $path  = $parts[0];

    // Só rotas de catálogo (lista/detalhe de produto, categorias, homepage).
    if ( ! preg_match( '#/biju/v1/(products|categories|homepage)(/|$)#', $path ) ) {
        return null;
    }

    parse_str( $parts[1] ?? '', $q );

    // Não cacheia busca textual (resultado muito variável / baixo reuso).
    if ( isset( $q['search'] ) || isset( $q['s'] ) ) {
        return null;
    }
    // Não cacheia requisição autenticada (evita servir algo específico de usuário).
    if ( ! empty( $_SERVER['HTTP_AUTHORIZATION'] ) || ! empty( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ) ) {
        return null;
    }

    ksort( $q );
    $norm = $path . '?' . http_build_query( $q );

    return [ 'path' => $path, 'norm' => $norm ];
}

/**
 * Versão atual do cache (no object cache, para leitura rápida sem tocar o banco).
 */
function biju_edge_version() {
    if ( ! function_exists( 'wp_cache_get' ) ) {
        return 1;
    }
    $found = false;
    $v = wp_cache_get( 'version', BIJU_EDGE_GROUP, false, $found );
    if ( ! $found || ! $v ) {
        $v = 1;
        wp_cache_set( 'version', $v, BIJU_EDGE_GROUP, 0 );
    }
    return (int) $v;
}

/**
 * Invalida tudo: incrementa a versão. As chaves antigas viram órfãs e expiram pelo TTL.
 * Chamado quando produto/estoque/categoria muda.
 */
function biju_edge_flush() {
    if ( ! function_exists( 'wp_cache_set' ) ) {
        return;
    }
    wp_cache_set( 'version', biju_edge_version() + 1, BIJU_EDGE_GROUP, 0 );
}

function biju_edge_key( string $norm, int $ver ): string {
    return 'r_' . md5( $norm ) . '_v' . $ver;
}

// ---------------------------------------------------------------------------
// 1) CAMINHO RÁPIDO — tenta servir do Redis ANTES de carregar os plugins.
// ---------------------------------------------------------------------------
$biju_edge_info = biju_edge_request_info();
if ( $biju_edge_info && function_exists( 'wp_cache_get' ) ) {
    $ver    = biju_edge_version();
    $key    = biju_edge_key( $biju_edge_info['norm'], $ver );
    $cached = wp_cache_get( $key, BIJU_EDGE_GROUP );

    if ( is_array( $cached ) && isset( $cached['b'] ) ) {
        // HIT: responde sem inicializar WooCommerce/Elementor/etc.
        header( 'Content-Type: application/json; charset=UTF-8' );
        header( 'X-Biju-Edge: HIT' );
        header( 'Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=600' );
        if ( ! empty( $cached['h'] ) && is_array( $cached['h'] ) ) {
            foreach ( $cached['h'] as $hk => $hv ) {
                header( $hk . ': ' . $hv );
            }
            // Garante que o JS leia os headers de paginação (caso cross-origin).
            header( 'Access-Control-Expose-Headers: X-WP-Total, X-WP-TotalPages, X-Biju-Edge' );
        }
        echo $cached['b'];
        exit;
    }
}

// ---------------------------------------------------------------------------
// 2) MISS — deixa o WordPress seguir, captura a resposta e grava no Redis.
// ---------------------------------------------------------------------------
if ( $biju_edge_info ) {
    add_filter( 'rest_post_dispatch', function ( $result, $server, $request ) use ( $biju_edge_info ) {
        if ( ! function_exists( 'wp_cache_set' ) || ! ( $result instanceof WP_REST_Response ) ) {
            return $result;
        }
        if ( $result->get_status() !== 200 ) {
            return $result;
        }

        $data = $result->get_data();
        $body = function_exists( 'wp_json_encode' ) ? wp_json_encode( $data ) : json_encode( $data );
        if ( $body === false ) {
            return $result;
        }

        // Preserva os headers de paginação que o handler de produtos define.
        $store_headers = [];
        $headers = $result->get_headers();
        foreach ( [ 'X-WP-Total', 'X-WP-TotalPages' ] as $h ) {
            if ( isset( $headers[ $h ] ) ) {
                $store_headers[ $h ] = $headers[ $h ];
            }
        }

        $ver = biju_edge_version();
        $key = biju_edge_key( $biju_edge_info['norm'], $ver );
        wp_cache_set( $key, [ 'b' => $body, 'h' => $store_headers ], BIJU_EDGE_GROUP, BIJU_EDGE_TTL );

        $result->header( 'X-Biju-Edge', 'MISS' );
        return $result;
    }, 9998, 3 );
}

// ---------------------------------------------------------------------------
// 3) INVALIDAÇÃO — qualquer mudança de produto/estoque/categoria zera o cache.
//    (mu-plugins rodam também no admin/checkout, então estes hooks disparam lá.)
// ---------------------------------------------------------------------------
add_action( 'init', function () {
    $flush = 'biju_edge_flush';

    // Estoque (inclui "ficar fora de estoque")
    add_action( 'woocommerce_product_set_stock',          $flush );
    add_action( 'woocommerce_variation_set_stock',        $flush );
    add_action( 'woocommerce_product_set_stock_status',   $flush );
    add_action( 'woocommerce_variation_set_stock_status', $flush );
    add_action( 'woocommerce_reduce_order_stock',         $flush ); // venda confirmada
    add_action( 'woocommerce_restore_order_stock',        $flush );

    // Produto (preço, título, publicar/despublicar, lixeira)
    add_action( 'save_post_product',        $flush );
    add_action( 'woocommerce_update_product', $flush );
    add_action( 'woocommerce_new_product',    $flush );
    add_action( 'trashed_post',              $flush );
    add_action( 'untrashed_post',            $flush );

    // Categorias / homepage
    add_action( 'created_product_cat', $flush );
    add_action( 'edited_product_cat',  $flush );
    add_action( 'delete_product_cat',  $flush );
    add_action( 'update_option_biju_homepage_sections', $flush );
    add_action( 'update_option_biju_nav_menu_id',        $flush );
}, 5 );
