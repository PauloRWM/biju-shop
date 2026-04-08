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
require_once BIJU_CONNECTOR_PATH . 'includes/class-cors.php';
require_once BIJU_CONNECTOR_PATH . 'includes/class-auth.php';
require_once BIJU_CONNECTOR_PATH . 'includes/class-products.php';
require_once BIJU_CONNECTOR_PATH . 'includes/class-orders.php';
require_once BIJU_CONNECTOR_PATH . 'includes/class-rest-api.php';

// Inicializar
add_action( 'plugins_loaded', function () {
    if ( ! class_exists( 'WooCommerce' ) ) return;

    Biju_CORS::init();
    Biju_REST_API::init();
});

// Página de configurações no admin
add_action( 'admin_menu', 'biju_admin_menu' );
function biju_admin_menu() {
    add_options_page(
        'Biju Shop Connector',
        'Biju Shop',
        'manage_options',
        'biju-shop-connector',
        'biju_admin_page'
    );
}

function biju_admin_page() {
    if ( ! current_user_can( 'manage_options' ) ) return;

    if ( isset( $_POST['biju_save'] ) && check_admin_referer( 'biju_settings' ) ) {
        update_option( 'biju_frontend_url', sanitize_url( $_POST['biju_frontend_url'] ?? '' ) );
        update_option( 'biju_jwt_secret', sanitize_text_field( $_POST['biju_jwt_secret'] ?? '' ) );
        update_option( 'biju_jwt_expiry', absint( $_POST['biju_jwt_expiry'] ?? 3600 ) );
        echo '<div class="updated"><p>Configurações salvas.</p></div>';
    }

    $frontend_url = get_option( 'biju_frontend_url', 'http://localhost:8080' );
    $jwt_secret   = get_option( 'biju_jwt_secret', wp_generate_password( 64, true, true ) );
    $jwt_expiry   = get_option( 'biju_jwt_expiry', 3600 );
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
});
