<?php
defined( 'ABSPATH' ) || exit;

/**
 * Registra todos os endpoints REST do plugin.
 *
 * Namespace: biju/v1
 */
class Biju_REST_API {

    public static function init() {
        add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ] );
        add_filter( 'rest_authentication_errors', [ __CLASS__, 'authenticate_jwt' ] );
    }

    public static function register_routes() {
        $ns = BIJU_API_NAMESPACE;

        // ---------------------------------------------------------------
        // Produtos
        // ---------------------------------------------------------------
        register_rest_route( $ns, '/products', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [ 'Biju_Products', 'get_products' ],
            'permission_callback' => '__return_true',
            'args'                => [
                'page'     => [ 'type' => 'integer', 'default' => 1, 'minimum' => 1 ],
                'per_page' => [ 'type' => 'integer', 'default' => 20, 'minimum' => 1, 'maximum' => 100 ],
                'category' => [ 'type' => 'string' ],
                'search'   => [ 'type' => 'string' ],
                'orderby'  => [ 'type' => 'string', 'enum' => [ 'date', 'price', 'popularity', 'rating', 'title' ], 'default' => 'date' ],
                'order'    => [ 'type' => 'string', 'enum' => [ 'ASC', 'DESC' ], 'default' => 'DESC' ],
                'featured' => [ 'type' => 'boolean' ],
            ],
        ] );

        register_rest_route( $ns, '/products/(?P<id>\d+)', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [ 'Biju_Products', 'get_product' ],
            'permission_callback' => '__return_true',
            'args'                => [
                'id' => [ 'type' => 'integer', 'required' => true ],
            ],
        ] );

        // ---------------------------------------------------------------
        // Categorias
        // ---------------------------------------------------------------
        register_rest_route( $ns, '/categories', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [ 'Biju_Products', 'get_categories' ],
            'permission_callback' => '__return_true',
        ] );

        // ---------------------------------------------------------------
        // Pedidos
        // ---------------------------------------------------------------
        register_rest_route( $ns, '/orders', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ 'Biju_Orders', 'create_order' ],
            'permission_callback' => '__return_true',
        ] );

        register_rest_route( $ns, '/orders/(?P<id>\d+)', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [ 'Biju_Orders', 'get_order' ],
            'permission_callback' => '__return_true', // auth checada dentro do handler
            'args'                => [
                'id' => [ 'type' => 'integer', 'required' => true ],
            ],
        ] );

        // ---------------------------------------------------------------
        // Autenticação
        // ---------------------------------------------------------------
        register_rest_route( $ns, '/auth/login', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ __CLASS__, 'login' ],
            'permission_callback' => '__return_true',
        ] );

        register_rest_route( $ns, '/auth/register', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ __CLASS__, 'register' ],
            'permission_callback' => '__return_true',
        ] );

        // ---------------------------------------------------------------
        // Conta do cliente (requer token)
        // ---------------------------------------------------------------
        register_rest_route( $ns, '/account', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [ __CLASS__, 'get_account' ],
            'permission_callback' => [ 'Biju_Auth', 'require_auth' ],
        ] );

        register_rest_route( $ns, '/account/orders', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [ 'Biju_Orders', 'get_customer_orders' ],
            'permission_callback' => [ 'Biju_Auth', 'require_auth' ],
        ] );
    }

    // -------------------------------------------------------------------------
    // Auth handlers
    // -------------------------------------------------------------------------

    public static function login( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $body     = $request->get_json_params();
        $username = sanitize_text_field( $body['username'] ?? $body['email'] ?? '' );
        $password = $body['password'] ?? '';

        if ( ! $username || ! $password ) {
            return new WP_Error( 'missing_credentials', 'Usuário e senha são obrigatórios.', [ 'status' => 400 ] );
        }

        $user = wp_authenticate( $username, $password );
        if ( is_wp_error( $user ) ) {
            return new WP_Error( 'invalid_credentials', 'Usuário ou senha inválidos.', [ 'status' => 401 ] );
        }

        return new WP_REST_Response( [
            'token' => Biju_Auth::generate_token( $user->ID ),
            'user'  => self::format_user( $user ),
        ], 200 );
    }

    public static function register( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $body  = $request->get_json_params();
        $email = sanitize_email( $body['email'] ?? '' );
        $pass  = $body['password'] ?? '';
        $name  = sanitize_text_field( $body['name'] ?? '' );

        if ( ! $email || ! $pass ) {
            return new WP_Error( 'missing_fields', 'E-mail e senha são obrigatórios.', [ 'status' => 400 ] );
        }
        if ( email_exists( $email ) ) {
            return new WP_Error( 'email_exists', 'E-mail já cadastrado.', [ 'status' => 409 ] );
        }
        if ( strlen( $pass ) < 6 ) {
            return new WP_Error( 'weak_password', 'A senha deve ter pelo menos 6 caracteres.', [ 'status' => 400 ] );
        }

        $names    = explode( ' ', $name, 2 );
        $user_id  = wc_create_new_customer( $email, $email, $pass, [
            'first_name' => $names[0] ?? '',
            'last_name'  => $names[1] ?? '',
        ] );

        if ( is_wp_error( $user_id ) ) {
            return new WP_Error( 'register_failed', $user_id->get_error_message(), [ 'status' => 500 ] );
        }

        $user = get_user_by( 'id', $user_id );

        return new WP_REST_Response( [
            'token' => Biju_Auth::generate_token( $user_id ),
            'user'  => self::format_user( $user ),
        ], 201 );
    }

    public static function get_account( WP_REST_Request $request ): WP_REST_Response {
        $user_id  = Biju_Auth::get_user_from_request( $request );
        $user     = get_user_by( 'id', $user_id );
        $customer = new WC_Customer( $user_id );

        return new WP_REST_Response( [
            'user'     => self::format_user( $user ),
            'billing'  => $customer->get_billing(),
            'shipping' => $customer->get_shipping(),
        ], 200 );
    }

    // -------------------------------------------------------------------------
    // JWT middleware — popula wp_get_current_user() com o token se presente
    // -------------------------------------------------------------------------

    public static function authenticate_jwt( $result ) {
        if ( ! empty( $result ) ) return $result; // já autenticado por outro método

        $request_uri = $_SERVER['REQUEST_URI'] ?? '';
        if ( ! str_contains( $request_uri, '/biju/v1/' ) ) return $result;

        $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if ( ! $auth && function_exists( 'getallheaders' ) ) {
            $headers = getallheaders();
            $auth    = $headers['Authorization'] ?? '';
        }

        if ( ! $auth || ! str_starts_with( $auth, 'Bearer ' ) ) return $result;

        $token   = substr( $auth, 7 );
        $user_id = Biju_Auth::validate_token( $token );

        if ( $user_id ) {
            wp_set_current_user( $user_id );
        }

        return $result;
    }

    // -------------------------------------------------------------------------

    private static function format_user( WP_User $user ): array {
        return [
            'id'        => $user->ID,
            'name'      => $user->display_name,
            'email'     => $user->user_email,
            'firstName' => $user->first_name,
            'lastName'  => $user->last_name,
        ];
    }
}
