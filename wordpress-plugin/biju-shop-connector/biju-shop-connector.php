<?php
/**
 * Plugin Name: Biju Shop Connector
 * Plugin URI:  https://bijushop.com.br
 * Description: Integra o frontend headless React do Biju Shop com o WooCommerce via REST API segura.
 * Version:     1.0.0
 * Author:      Biju Shop
 * License:     GPL-2.0+
 * Text Domain: biju-shop-connector
 *
 * Requer WooCommerce ativo.
 */

defined( 'ABSPATH' ) || exit;

define( 'BIJU_CONNECTOR_VERSION', '1.0.0' );
define( 'BIJU_CONNECTOR_PATH', plugin_dir_path( __FILE__ ) );
define( 'BIJU_CONNECTOR_URL', plugin_dir_url( __FILE__ ) );
define( 'BIJU_API_NAMESPACE', 'biju/v1' );

// Compatibilidade com a tela moderna de pedidos do WooCommerce (HPOS / wc-orders).
add_action( 'before_woocommerce_init', function () {
    if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility(
            'custom_order_tables',
            __FILE__,
            true
        );
    }
} );

// ───────────────────────────────────────────────────────────────────────────
// Tamanhos de imagem dedicados ao card do frontend.
//
// O card de produto é exibido a ~177px (mobile) / ~300px (desktop). O tamanho
// padrão 'woocommerce_thumbnail' costuma vir grande demais (ou cair no original
// quando não foi gerado). Registramos dois tamanhos próprios para montar um
// srcset enxuto: 1x (~360px) e 2x (~540px, para telas retina).
//
// Após adicionar/alterar estes tamanhos, regenere as miniaturas existentes
// (plugin "Regenerate Thumbnails" ou wp-cli `wp media regenerate`).
// ───────────────────────────────────────────────────────────────────────────
add_action( 'after_setup_theme', function () {
    add_image_size( 'biju_card', 360, 450, true );      // 1x — crop 4:5
    add_image_size( 'biju_card_2x', 540, 675, true );   // 2x retina — crop 4:5
} );

// ───────────────────────────────────────────────────────────────────────────
// BLOQUEIO PERMANENTE DE ENCOMENDAS (BACKORDERS)
//
// Garante que NENHUM produto aceite encomenda (venda com estoque <= 0), mesmo
// que a opção "Permitir encomendas" seja ativada por engano no admin, por
// importação de planilha ou por sincronização de outro plugin.
//
//   - woocommerce_product_get_backorders / _variation_get_backorders:
//       força a leitura do valor sempre como 'no' em qualquer produto/variação.
//   - woocommerce_product_backorders_allowed:
//       garante que a checagem "encomenda permitida?" sempre retorne falso.
//   - woocommerce_product_get_stock_status / _variation_get_stock_status:
//       converte qualquer status 'onbackorder' para 'outofstock'.
//
// Efeito: produtos esgotados aparecem como "Fora de estoque" e nunca como
// "Disponível por encomenda"; o aviso de encomenda deixa de ser disparado.
// ───────────────────────────────────────────────────────────────────────────
add_filter( 'woocommerce_product_get_backorders', 'biju_forcar_sem_encomenda', 99 );
add_filter( 'woocommerce_product_variation_get_backorders', 'biju_forcar_sem_encomenda', 99 );
function biju_forcar_sem_encomenda( $value ) {
    return 'no';
}

add_filter( 'woocommerce_product_backorders_allowed', '__return_false', 99 );

add_filter( 'woocommerce_product_get_stock_status', 'biju_sem_status_encomenda', 99 );
add_filter( 'woocommerce_product_variation_get_stock_status', 'biju_sem_status_encomenda', 99 );
function biju_sem_status_encomenda( $status ) {
    return ( 'onbackorder' === $status ) ? 'outofstock' : $status;
}

// Verificar dependência do WooCommerce
add_action( 'admin_init', 'biju_check_woocommerce' );
function biju_check_woocommerce() {
    if ( ! class_exists( 'WooCommerce' ) ) {
        add_action( 'admin_notices', function () {
            echo '<div class="error"><p><strong>Biju Shop Connector</strong> requer o WooCommerce ativo.</p></div>';
        });
        deactivate_plugins( plugin_basename( __FILE__ ) );
    }
}

// Carregar módulos
require_once BIJU_CONNECTOR_PATH . 'includes/class-cache.php';
require_once BIJU_CONNECTOR_PATH . 'includes/class-perf-probe.php'; // diagnóstico temporário
require_once BIJU_CONNECTOR_PATH . 'includes/class-cors.php';
require_once BIJU_CONNECTOR_PATH . 'includes/class-auth.php';
require_once BIJU_CONNECTOR_PATH . 'includes/class-products.php';
require_once BIJU_CONNECTOR_PATH . 'includes/class-mp-processor.php';
require_once BIJU_CONNECTOR_PATH . 'includes/class-orders.php';
require_once BIJU_CONNECTOR_PATH . 'includes/class-homepage.php';
require_once BIJU_CONNECTOR_PATH . 'includes/class-newsletter.php';
require_once BIJU_CONNECTOR_PATH . 'includes/class-meta-pixel.php';
require_once BIJU_CONNECTOR_PATH . 'includes/class-shipping.php';
require_once BIJU_CONNECTOR_PATH . 'includes/class-coupons.php';
require_once BIJU_CONNECTOR_PATH . 'includes/class-abandoned-cart.php';
require_once BIJU_CONNECTOR_PATH . 'includes/class-product-duplicator.php';
require_once BIJU_CONNECTOR_PATH . 'includes/class-stock-monitor.php';
require_once BIJU_CONNECTOR_PATH . 'includes/class-rest-api.php';

// Inicializar
add_action( 'plugins_loaded', function () {
    if ( ! class_exists( 'WooCommerce' ) ) return;

    Biju_CORS::init();
    Biju_Cache::init();
    Biju_Perf_Probe::init(); // diagnóstico temporário — remover depois
    Biju_REST_API::init();
    Biju_Meta_Pixel::init();
    Biju_Product_Duplicator::init();

    // Envio em background do e-mail "novo pedido" agendado no checkout
    // (mantém o SMTP fora do caminho crítico da resposta ao cliente).
    add_action( Biju_Orders::NEW_ORDER_EMAIL_HOOK, [ 'Biju_Orders', 'send_new_order_email' ], 10, 1 );

    // Reembolso: quando admin clica "Reembolsar" no painel Woo, chama nossa API MP.
    // Hook do Woo: woocommerce_refund_created($refund_id, $args). $args contém
    // 'order_id' e 'amount'. O refund object pode ser carregado via wc_get_order().
    add_action( 'woocommerce_refund_created', function ( $refund_id, $args ) {
        $refund = wc_get_order( $refund_id );
        if ( ! ( $refund instanceof WC_Order_Refund ) ) return;
        $order_id = $refund->get_parent_id();
        $order    = $order_id ? wc_get_order( $order_id ) : null;
        if ( ! $order || ! $order->get_meta( '_mp_payment_id' ) ) return;
        $amount = (float) $refund->get_amount();
        $result = Biju_MP_Processor::refund( $order, $amount > 0 ? $amount : null );
        if ( ! empty( $result['error'] ) ) {
            $order->add_order_note( 'Reembolso MP falhou: ' . ( $result['message'] ?? $result['error'] ) );
        } else {
            $order->add_order_note( 'Reembolso MP ok. refund_id=' . ( $result['refund_id'] ?? '?' ) );
        }
    }, 10, 2 );
});

// Páginas de administração
add_action( 'admin_menu', 'biju_admin_menu' );
function biju_admin_menu() {
    // Página de estoque — top-level (menu próprio) para acesso rápido pela equipe.
    add_menu_page(
        'Estoque — Biju Shop',
        'Estoque',
        'manage_woocommerce',
        'biju-stock',
        [ 'Biju_Stock_Monitor', 'render_page' ],
        'dashicons-products',
        56
    );

    add_options_page(
        'Biju Shop — Página Inicial',
        'Biju Shop — Página Inicial',
        'manage_options',
        'biju-homepage',
        [ 'Biju_Homepage', 'render_page' ]
    );

    add_options_page(
        'Biju Shop — Newsletter',
        'Biju Shop — Newsletter',
        'manage_options',
        'biju-newsletter',
        [ 'Biju_Newsletter', 'render_page' ]
    );

    add_options_page(
        'Biju Shop — Meta Pixel/CAPI',
        'Biju Shop — Meta Ads',
        'manage_options',
        'biju-meta',
        'biju_meta_admin_page'
    );

    add_options_page(
        'Biju Shop Connector',
        'Biju Shop',
        'manage_options',
        'biju-shop-connector',
        'biju_admin_page'
    );
}

function biju_meta_admin_page() {
    if ( ! current_user_can( 'manage_options' ) ) return;

    if ( isset( $_POST['biju_meta_save'] ) && check_admin_referer( 'biju_meta_settings' ) ) {
        update_option( 'biju_meta_enabled',         ! empty( $_POST['biju_meta_enabled'] ) );
        update_option( 'biju_meta_pixel_id',        sanitize_text_field( $_POST['biju_meta_pixel_id'] ?? '' ) );
        update_option( 'biju_meta_access_token',    sanitize_text_field( $_POST['biju_meta_access_token'] ?? '' ) );
        update_option( 'biju_meta_test_event_code', sanitize_text_field( $_POST['biju_meta_test_event_code'] ?? '' ) );
        echo '<div class="updated"><p>Configurações do Meta salvas.</p></div>';
    }

    // Teste manual de envio CAPI
    if ( isset( $_POST['biju_meta_test'] ) && check_admin_referer( 'biju_meta_settings' ) ) {
        $result = Biju_Meta_Pixel::send_events( [
            [
                'event_name'       => 'PageView',
                'event_time'       => time(),
                'event_id'         => 'admin_test_' . time(),
                'action_source'    => 'website',
                'event_source_url' => get_option( 'biju_frontend_url', home_url() ),
                'user_data'        => array_filter( [
                    'client_ip_address' => Biju_Meta_Pixel::client_ip(),
                    'client_user_agent' => Biju_Meta_Pixel::client_user_agent(),
                ] ),
            ],
        ] );
        if ( ! empty( $result['success'] ) ) {
            echo '<div class="updated"><p><strong>Evento de teste enviado com sucesso!</strong> Verifique no Gerenciador de Eventos do Meta.</p></div>';
        } else {
            echo '<div class="error"><p><strong>Falha:</strong> <code>' . esc_html( wp_json_encode( $result ) ) . '</code></p></div>';
        }
    }

    $cfg = Biju_Meta_Pixel::get_config();
    ?>
    <div class="wrap">
        <h1>Biju Shop — Meta Pixel & Conversions API</h1>
        <p>Integração servidor-a-servidor com o Meta para corrigir discrepâncias de tracking causadas por adblock, ITP, iOS 14+ e perda de cookies. Eventos são enviados em paralelo pelo navegador (pixel) e pelo servidor (CAPI), com o mesmo <code>event_id</code> para deduplicação automática.</p>

        <form method="post">
            <?php wp_nonce_field( 'biju_meta_settings' ); ?>
            <table class="form-table">
                <tr>
                    <th><label for="biju_meta_enabled">Ativar integração</label></th>
                    <td>
                        <label>
                            <input type="checkbox" id="biju_meta_enabled" name="biju_meta_enabled"
                                   value="1" <?php checked( $cfg['enabled'] ); ?> />
                            Enviar eventos para o Meta (pixel + CAPI)
                        </label>
                    </td>
                </tr>
                <tr>
                    <th><label for="biju_meta_pixel_id">Pixel ID</label></th>
                    <td>
                        <input type="text" id="biju_meta_pixel_id" name="biju_meta_pixel_id"
                               value="<?php echo esc_attr( $cfg['pixel_id'] ); ?>" class="regular-text" />
                        <p class="description">Encontre em: Gerenciador de Eventos → Fonte de Dados → Configurações.</p>
                    </td>
                </tr>
                <tr>
                    <th><label for="biju_meta_access_token">Conversions API Access Token</label></th>
                    <td>
                        <input type="password" id="biju_meta_access_token" name="biju_meta_access_token"
                               value="<?php echo esc_attr( $cfg['access_token'] ); ?>" class="large-text" autocomplete="off" />
                        <p class="description">
                            Gerar em: Gerenciador de Eventos → Configurações → Conversions API → "Gerar token de acesso".
                            Este token nunca é exposto ao frontend.
                        </p>
                    </td>
                </tr>
                <tr>
                    <th><label for="biju_meta_test_event_code">Test Event Code <em>(opcional)</em></label></th>
                    <td>
                        <input type="text" id="biju_meta_test_event_code" name="biju_meta_test_event_code"
                               value="<?php echo esc_attr( $cfg['test_event_code'] ); ?>" class="regular-text"
                               placeholder="TEST12345" />
                        <p class="description">
                            Use durante a configuração para que os eventos apareçam apenas em "Eventos de teste" no Gerenciador. <strong>Remova em produção</strong>.
                        </p>
                    </td>
                </tr>
            </table>

            <h2>Eventos enviados</h2>
            <table class="widefat striped" style="max-width:760px">
                <thead><tr><th>Evento</th><th>Disparo</th><th>Pixel</th><th>CAPI</th></tr></thead>
                <tbody>
                    <tr><td><code>PageView</code></td><td>Toda navegação</td><td>✓</td><td>✓</td></tr>
                    <tr><td><code>ViewContent</code></td><td>Página de produto</td><td>✓</td><td>✓</td></tr>
                    <tr><td><code>AddToCart</code></td><td>Adicionar ao carrinho</td><td>✓</td><td>✓</td></tr>
                    <tr><td><code>InitiateCheckout</code></td><td>Início do checkout</td><td>✓</td><td>✓</td></tr>
                    <tr><td><code>Purchase</code></td><td>Pedido pago (status processing/completed)</td><td>✓ <small>(no checkout)</small></td><td>✓ <small>(via webhook WooCommerce)</small></td></tr>
                </tbody>
            </table>

            <p>
                <?php submit_button( 'Salvar configurações', 'primary', 'biju_meta_save', false ); ?>
                &nbsp;
                <?php submit_button( 'Enviar evento de teste (PageView)', 'secondary', 'biju_meta_test', false ); ?>
            </p>
        </form>
    </div>
    <?php
}

function biju_admin_page() {
    if ( ! current_user_can( 'manage_options' ) ) return;

    if ( isset( $_POST['biju_save'] ) && check_admin_referer( 'biju_settings' ) ) {
        update_option( 'biju_frontend_url', sanitize_url( $_POST['biju_frontend_url'] ?? '' ) );
        update_option( 'biju_jwt_secret', sanitize_text_field( $_POST['biju_jwt_secret'] ?? '' ) );
        update_option( 'biju_jwt_expiry', absint( $_POST['biju_jwt_expiry'] ?? 3600 ) );
        update_option( 'biju_google_client_id', sanitize_text_field( $_POST['biju_google_client_id'] ?? '' ) );
        echo '<div class="updated"><p>Configurações salvas.</p></div>';
    }

    $frontend_url     = get_option( 'biju_frontend_url', 'http://localhost:8080' );
    $jwt_secret       = get_option( 'biju_jwt_secret', wp_generate_password( 64, true, true ) );
    $jwt_expiry       = get_option( 'biju_jwt_expiry', 3600 );
    $google_client_id = get_option( 'biju_google_client_id', '' );
    ?>
    <div class="wrap">
        <h1>Biju Shop Connector</h1>
        <form method="post">
            <?php wp_nonce_field( 'biju_settings' ); ?>
            <table class="form-table">
                <tr>
                    <th><label for="biju_frontend_url">URL do Frontend</label></th>
                    <td>
                        <input type="url" id="biju_frontend_url" name="biju_frontend_url"
                               value="<?php echo esc_attr( $frontend_url ); ?>" class="regular-text" />
                        <p class="description">URL do app React (ex: https://bijushop.com.br ou http://localhost:8080 para dev)</p>
                    </td>
                </tr>
                <tr>
                    <th><label for="biju_jwt_secret">JWT Secret</label></th>
                    <td>
                        <input type="text" id="biju_jwt_secret" name="biju_jwt_secret"
                               value="<?php echo esc_attr( $jwt_secret ); ?>" class="large-text" />
                        <p class="description">Chave secreta para assinar tokens JWT. Mantenha segura!</p>
                    </td>
                </tr>
                <tr>
                    <th><label for="biju_jwt_expiry">Expiração do Token (segundos)</label></th>
                    <td>
                        <input type="number" id="biju_jwt_expiry" name="biju_jwt_expiry"
                               value="<?php echo esc_attr( $jwt_expiry ); ?>" min="300" />
                        <p class="description">Padrão: 3600 (1 hora). Use 86400 para 24h.</p>
                    </td>
                </tr>
                <tr>
                    <th><label for="biju_google_client_id">Google OAuth Client ID</label></th>
                    <td>
                        <input type="text" id="biju_google_client_id" name="biju_google_client_id"
                               value="<?php echo esc_attr( $google_client_id ); ?>" class="large-text" />
                        <p class="description">Client ID do Google Cloud Console (formato: <code>xxxxx.apps.googleusercontent.com</code>). Necessário para o login com Google.</p>
                    </td>
                </tr>
            </table>

            <h2>Endpoints Disponíveis</h2>
            <table class="widefat striped">
                <thead><tr><th>Método</th><th>Endpoint</th><th>Descrição</th></tr></thead>
                <tbody>
                    <tr><td>GET</td><td><code><?php echo rest_url( 'biju/v1/products' ); ?></code></td><td>Listar produtos (público)</td></tr>
                    <tr><td>GET</td><td><code><?php echo rest_url( 'biju/v1/products/{id}' ); ?></code></td><td>Detalhe do produto (público)</td></tr>
                    <tr><td>GET</td><td><code><?php echo rest_url( 'biju/v1/categories' ); ?></code></td><td>Categorias (público)</td></tr>
                    <tr><td>POST</td><td><code><?php echo rest_url( 'biju/v1/orders' ); ?></code></td><td>Criar pedido (público)</td></tr>
                    <tr><td>GET</td><td><code><?php echo rest_url( 'biju/v1/orders/{id}' ); ?></code></td><td>Status do pedido (token)</td></tr>
                    <tr><td>POST</td><td><code><?php echo rest_url( 'biju/v1/auth/login' ); ?></code></td><td>Login (público)</td></tr>
                    <tr><td>POST</td><td><code><?php echo rest_url( 'biju/v1/auth/register' ); ?></code></td><td>Registro (público)</td></tr>
                    <tr><td>POST</td><td><code><?php echo rest_url( 'biju/v1/auth/google' ); ?></code></td><td>Login com Google (público)</td></tr>
                    <tr><td>GET</td><td><code><?php echo rest_url( 'biju/v1/auth/google/config' ); ?></code></td><td>Client ID público do Google (público)</td></tr>
                    <tr><td>GET</td><td><code><?php echo rest_url( 'biju/v1/account' ); ?></code></td><td>Conta do usuário (token)</td></tr>
                    <tr><td>GET</td><td><code><?php echo rest_url( 'biju/v1/account/orders' ); ?></code></td><td>Pedidos do usuário (token)</td></tr>
                </tbody>
            </table>

            <?php submit_button( 'Salvar', 'primary', 'biju_save' ); ?>
        </form>
    </div>
    <?php
}

// Salvar JWT secret padrão na ativação
register_activation_hook( __FILE__, function () {
    if ( ! get_option( 'biju_jwt_secret' ) ) {
        update_option( 'biju_jwt_secret', wp_generate_password( 64, true, true ) );
    }
    if ( ! get_option( 'biju_jwt_expiry' ) ) {
        update_option( 'biju_jwt_expiry', 3600 );
    }
    
    // Criar tabela de newsletter
    Biju_Newsletter::create_table();
});
