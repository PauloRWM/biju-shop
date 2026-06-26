<?php
defined( 'ABSPATH' ) || exit;

/**
 * Cache leve para respostas quase-estáticas da API (produtos, categorias, homepage).
 *
 * Estratégia: invalidação por VERSÃO. Em vez de rastrear cada chave de transient,
 * mantemos um contador ("versão") incluído na chave de cache. Quando um produto ou
 * categoria muda, incrementamos a versão — todas as chaves antigas viram órfãs e
 * expiram sozinhas pelo TTL. Isso evita varrer/limpar transients um a um.
 *
 * Quando há object cache persistente (Redis/Memcached), os transients são servidos
 * de memória automaticamente.
 */
class Biju_Cache {

    /** Opção que guarda a versão atual do cache de dados de produto. */
    const VERSION_OPTION = 'biju_cache_version';

    /**
     * Registra os hooks que invalidam o cache quando produtos/categorias mudam.
     */
    public static function init(): void {
        $bump = [ __CLASS__, 'bump_version' ];

        // Produtos
        add_action( 'save_post_product',                 $bump );
        add_action( 'woocommerce_new_product',           $bump );
        add_action( 'woocommerce_update_product',        $bump );
        add_action( 'woocommerce_product_set_stock',     $bump );
        add_action( 'woocommerce_variation_set_stock',   $bump );
        add_action( 'woocommerce_product_set_stock_status', $bump );
        add_action( 'woocommerce_reduce_order_stock',    $bump );
        add_action( 'woocommerce_restore_order_stock',   $bump );
        add_action( 'trashed_post',                      $bump );
        add_action( 'untrashed_post',                    $bump );

        // Categorias
        add_action( 'created_product_cat', $bump );
        add_action( 'edited_product_cat',  $bump );
        add_action( 'delete_product_cat',  $bump );

        // Configuração da homepage/menu (admin)
        add_action( 'update_option_biju_homepage_sections', $bump );
        add_action( 'update_option_biju_nav_menu_id',        $bump );
    }

    /**
     * Versão atual do cache de dados de produto.
     */
    public static function version(): int {
        return (int) get_option( self::VERSION_OPTION, 1 );
    }

    /**
     * Incrementa a versão — invalida todo o cache de produtos/categorias/homepage.
     */
    public static function bump_version(): void {
        update_option( self::VERSION_OPTION, self::version() + 1, false );
    }

    /**
     * Retorna o valor cacheado para $key ou executa $callback, cacheia e retorna.
     *
     * @param string   $key      Chave lógica (será combinada com a versão atual).
     * @param int      $ttl      Tempo de vida em segundos.
     * @param callable $callback Produz o valor quando não há cache.
     */
    public static function remember( string $key, int $ttl, callable $callback ) {
        $transient = 'biju_c_' . md5( $key . '|v' . self::version() );

        $cached = get_transient( $transient );
        if ( false !== $cached ) {
            return $cached;
        }

        $value = $callback();
        set_transient( $transient, $value, $ttl );
        return $value;
    }
}
