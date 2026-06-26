<?php
defined( 'ABSPATH' ) || exit;

/**
 * Diagnóstico de performance TEMPORÁRIO.
 *
 * Expõe nos headers X-Biju-* onde o tempo de cada requisição REST é gasto:
 * tempo total, nº de queries, chamadas HTTP externas (e para quais hosts),
 * tamanho do autoload, memória, versão do PHP e status do OPcache.
 *
 * Carregado pelo biju-shop-connector.php. REMOVER (ou desligar) após diagnosticar:
 * basta comentar a linha Biju_Perf_Probe::init() no arquivo principal.
 *
 * Ler os headers:
 *   curl -sD - -o /dev/null 'https://SEU-SITE/wp-json/biju/v1/payment-config' | grep -i x-biju
 */
class Biju_Perf_Probe {

    private static $http_count = 0;
    private static $http_time  = 0.0;
    private static $http_hosts = [];
    private static $http_start = [];

    /** Marcos de tempo (ms desde o início da requisição) por fase do boot. */
    private static $phases = [];

    public static function init(): void {
        // init() roda dentro do callback de 'plugins_loaded' do connector, ou seja,
        // já depois de TODOS os arquivos de plugin terem sido carregados. Logo este
        // marco mede quanto custou carregar core + WooCommerce + todos os plugins.
        self::mark( 'plugins_loaded' );

        // Marcos das fases seguintes do boot.
        add_action( 'setup_theme',       fn() => self::mark( 'setup_theme' ),  -PHP_INT_MAX );
        add_action( 'after_setup_theme', fn() => self::mark( 'after_theme' ),   PHP_INT_MAX );
        add_action( 'init',              fn() => self::mark( 'init' ),         -PHP_INT_MAX );
        add_action( 'wp_loaded',         fn() => self::mark( 'wp_loaded' ),     PHP_INT_MAX );
        add_action( 'rest_api_init',     fn() => self::mark( 'rest_api_init' ), PHP_INT_MAX );

        // Marca o início de cada chamada wp_remote_* (sem interromper a chamada).
        add_filter( 'pre_http_request', [ __CLASS__, 'on_http_start' ], 0, 3 );
        // Ao concluir, soma a duração e registra o host.
        add_action( 'http_api_debug', [ __CLASS__, 'on_http_done' ], 10, 5 );
        // Anexa os headers de diagnóstico na resposta REST.
        add_filter( 'rest_post_dispatch', [ __CLASS__, 'add_headers' ], 9999, 3 );
    }

    /** Registra o instante (ms desde o início da requisição) de uma fase. */
    private static function mark( string $name ): void {
        $start = isset( $_SERVER['REQUEST_TIME_FLOAT'] )
            ? (float) $_SERVER['REQUEST_TIME_FLOAT']
            : microtime( true );
        self::$phases[ $name ] = round( ( microtime( true ) - $start ) * 1000 );
    }

    /** Monta "fase=ms" na ordem do boot. */
    private static function phases_string(): string {
        $order = [ 'plugins_loaded', 'setup_theme', 'after_theme', 'init', 'wp_loaded', 'rest_api_init', 'dispatch' ];
        $out = [];
        foreach ( $order as $ph ) {
            if ( isset( self::$phases[ $ph ] ) ) {
                $out[] = $ph . '=' . self::$phases[ $ph ] . 'ms';
            }
        }
        return implode( ' ', $out ) ?: '-';
    }

    public static function on_http_start( $pre, $args, $url ) {
        self::$http_start[ $url ] = microtime( true );
        return $pre; // normalmente false — deixa a requisição seguir
    }

    public static function on_http_done( $response, $context, $class, $args, $url ) {
        self::$http_count++;
        if ( isset( self::$http_start[ $url ] ) ) {
            self::$http_time += ( microtime( true ) - self::$http_start[ $url ] );
        }
        $host = wp_parse_url( $url, PHP_URL_HOST );
        if ( $host ) {
            self::$http_hosts[ $host ] = ( self::$http_hosts[ $host ] ?? 0 ) + 1;
        }
    }

    private static function autoload_stats(): array {
        global $wpdb;
        $row = $wpdb->get_row(
            "SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(option_value)),0) AS bytes
             FROM {$wpdb->options} WHERE autoload = 'yes'"
        );
        return [
            'count' => (int) ( $row->n ?? 0 ),
            'bytes' => (int) ( $row->bytes ?? 0 ),
        ];
    }

    public static function add_headers( $result, $server, $request ) {
        if ( ! ( $result instanceof WP_REST_Response ) ) {
            return $result;
        }

        $start = isset( $_SERVER['REQUEST_TIME_FLOAT'] )
            ? (float) $_SERVER['REQUEST_TIME_FLOAT']
            : microtime( true );
        $total_ms = round( ( microtime( true ) - $start ) * 1000 );

        $autoload = self::autoload_stats();

        arsort( self::$http_hosts );
        $hosts = [];
        foreach ( self::$http_hosts as $h => $c ) {
            $hosts[] = "{$h}({$c})";
        }

        // Quebra do boot por fase (ms desde o início da requisição).
        self::mark( 'dispatch' );

        // Lista de plugins ativos (basename da pasta) — para identificar suspeitos.
        $active = (array) get_option( 'active_plugins', [] );
        if ( is_multisite() ) {
            $active = array_merge( $active, array_keys( (array) get_site_option( 'active_sitewide_plugins', [] ) ) );
        }
        $plugin_slugs = array_map( function ( $p ) {
            return strstr( $p, '/', true ) ?: basename( $p, '.php' );
        }, $active );

        $result->header( 'X-Biju-Total-ms',     (string) $total_ms );
        $result->header( 'X-Biju-Phases',       self::phases_string() );
        $result->header( 'X-Biju-Plugins-Cnt',  (string) count( $active ) );
        $result->header( 'X-Biju-Plugins',      implode( ',', $plugin_slugs ) );
        $result->header( 'X-Biju-Queries',      (string) get_num_queries() );
        $result->header( 'X-Biju-HTTP-Count',   (string) self::$http_count );
        $result->header( 'X-Biju-HTTP-ms',      (string) round( self::$http_time * 1000 ) );
        $result->header( 'X-Biju-HTTP-Hosts',   implode( ',', array_slice( $hosts, 0, 10 ) ) ?: '-' );
        $result->header( 'X-Biju-Autoload-KB',  (string) round( $autoload['bytes'] / 1024 ) );
        $result->header( 'X-Biju-Autoload-Cnt', (string) $autoload['count'] );
        $result->header( 'X-Biju-Mem-MB',       (string) round( memory_get_peak_usage( true ) / 1048576, 1 ) );
        $result->header( 'X-Biju-PHP',          PHP_VERSION );

        // Estatísticas do OPcache — para confirmar saturação (causa dos hits frios).
        $opc = function_exists( 'opcache_get_status' ) ? @opcache_get_status( false ) : false;
        if ( is_array( $opc ) ) {
            $stats = $opc['opcache_statistics'] ?? [];
            $mem   = $opc['memory_usage'] ?? [];
            $scripts = (int) ( $stats['num_cached_scripts'] ?? 0 );
            $maxkeys = (int) ( $stats['max_cached_keys'] ?? 0 );
            $used_mb  = round( ( $mem['used_memory'] ?? 0 ) / 1048576 );
            $free_mb  = round( ( $mem['free_memory'] ?? 0 ) / 1048576 );
            $full = ! empty( $opc['cache_full'] ) ? 'FULL' : 'ok';
            $oom  = (int) ( $stats['oom_restarts'] ?? 0 );
            $result->header(
                'X-Biju-OPcache',
                "on scripts={$scripts}/{$maxkeys} mem_used={$used_mb}MB free={$free_mb}MB {$full} oom_restarts={$oom}"
            );
        } else {
            $result->header( 'X-Biju-OPcache', 'off' );
        }

        // Garante que o JS do front consiga ler os headers (CORS) — opcional p/ curl.
        $result->header( 'Access-Control-Expose-Headers', 'X-WP-Total, X-WP-TotalPages, X-Biju-Total-ms, X-Biju-Phases, X-Biju-Plugins-Cnt, X-Biju-Plugins, X-Biju-Queries, X-Biju-HTTP-Count, X-Biju-HTTP-ms, X-Biju-HTTP-Hosts, X-Biju-Autoload-KB, X-Biju-Autoload-Cnt, X-Biju-Mem-MB, X-Biju-PHP, X-Biju-OPcache' );

        return $result;
    }
}
