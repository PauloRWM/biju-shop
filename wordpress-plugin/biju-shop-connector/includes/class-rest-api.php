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
        // Configuração da página inicial / menu
        // ---------------------------------------------------------------
        register_rest_route( $ns, '/homepage', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [ 'Biju_Homepage', 'get_config' ],
            'permission_callback' => '__return_true',
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
        // Newsletter / WhatsApp
        // ---------------------------------------------------------------
        register_rest_route( $ns, '/newsletter', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ 'Biju_Newsletter', 'subscribe' ],
            'permission_callback' => '__return_true',
            'args'                => [
                'whatsapp' => [ 'type' => 'string', 'required' => true ],
            ],
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

        register_rest_route( $ns, '/auth/forgot-password', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ __CLASS__, 'forgot_password' ],
            'permission_callback' => '__return_true',
            'args'                => [
                'email' => [ 'type' => 'string', 'required' => true ],
            ],
        ] );

        register_rest_route( $ns, '/auth/google', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ __CLASS__, 'google_login' ],
            'permission_callback' => '__return_true',
            'args'                => [
                'credential' => [ 'type' => 'string', 'required' => true ],
            ],
        ] );

        register_rest_route( $ns, '/auth/google/config', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [ __CLASS__, 'google_config' ],
            'permission_callback' => '__return_true',
        ] );

        // Diagnóstico — quem fornece o Client ID? Útil para verificar se o
        // plugin está pegando do Site Kit. Devolve campos vazios em prod
        // pra não vazar nada sensível.
        register_rest_route( $ns, '/auth/google/debug', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [ __CLASS__, 'google_debug' ],
            'permission_callback' => '__return_true',
        ] );

        // ---------------------------------------------------------------
        // Pagamento (config pública — apenas public key)
        // ---------------------------------------------------------------
        register_rest_route( $ns, '/payment-config', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [ __CLASS__, 'payment_config' ],
            'permission_callback' => '__return_true',
        ] );

        // Webhook do Mercado Pago (notificações de pagamento PIX/boleto/cartão).
        // URL completa fica em get_rest_url() . 'biju/v1/mp-webhook' — configurar no
        // painel do MP em "Suas integrações → Webhooks → Notificações".
        register_rest_route( $ns, '/mp-webhook', [
            'methods'             => [ 'GET', 'POST' ],
            'callback'            => [ 'Biju_MP_Processor', 'handle_webhook' ],
            'permission_callback' => '__return_true',
        ] );

        // ---------------------------------------------------------------
        // Meta Pixel / CAPI
        // ---------------------------------------------------------------
        register_rest_route( $ns, '/meta/config', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [ __CLASS__, 'meta_config' ],
            'permission_callback' => '__return_true',
        ] );

        register_rest_route( $ns, '/meta/track', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ __CLASS__, 'meta_track' ],
            'permission_callback' => '__return_true',
            'args'                => [
                'event_name' => [ 'type' => 'string', 'required' => true ],
            ],
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

        // ---------------------------------------------------------------
        // Cupons (valida contra WC_Coupon e calcula desconto)
        // ---------------------------------------------------------------
        register_rest_route( $ns, '/coupon/validate', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ 'Biju_Coupons', 'validate' ],
            'permission_callback' => '__return_true',
            'args'                => [
                'code' => [ 'type' => 'string', 'required' => true ],
            ],
        ] );

        // ---------------------------------------------------------------
        // Cálculo de frete (usa zonas/métodos do WooCommerce)
        // ---------------------------------------------------------------
        Biju_Shipping::register_routes();
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

    /**
     * Dispara o fluxo nativo do WordPress de recuperação de senha
     * (retrieve_password) que envia o e-mail padrão com link para
     * wp-login.php?action=rp&key=...&login=...
     *
     * Para evitar enumeração de e-mails, devolvemos sempre 200 com a
     * mesma mensagem, independente do e-mail existir ou não.
     */
    public static function forgot_password( WP_REST_Request $request ): WP_REST_Response {
        $body  = $request->get_json_params();
        $email = sanitize_email( $body['email'] ?? '' );

        if ( $email ) {
            $user = get_user_by( 'email', $email );
            if ( $user instanceof WP_User ) {
                // retrieve_password() está disponível em wp-includes/user.php desde o WP 5.7
                // e cuida de gerar a chave, salvar em user_activation_key e enviar o e-mail
                // padrão com link para wp-login.php?action=rp&key=...&login=...
                retrieve_password( $user->user_login );
            }
        }

        return new WP_REST_Response( [
            'success' => true,
            'message' => 'Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.',
        ], 200 );
    }

    /**
     * Login com Google ID Token (Google Identity Services).
     * O frontend envia o `credential` retornado pelo Google e validamos
     * o JWT contra o endpoint público tokeninfo do Google.
     */
    public static function google_login( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $body       = $request->get_json_params();
        $credential = $body['credential'] ?? '';
        $client_id  = self::resolve_google_client_id();

        if ( ! $credential ) {
            return new WP_Error( 'missing_credential', 'Credential do Google não informado.', [ 'status' => 400 ] );
        }
        if ( ! $client_id ) {
            return new WP_Error( 'google_not_configured', 'Login com Google não está configurado.', [ 'status' => 503 ] );
        }

        $resp = wp_remote_get(
            'https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode( $credential ),
            [ 'timeout' => 10 ]
        );

        if ( is_wp_error( $resp ) ) {
            return new WP_Error( 'google_unreachable', 'Não foi possível validar com o Google.', [ 'status' => 502 ] );
        }
        if ( wp_remote_retrieve_response_code( $resp ) !== 200 ) {
            return new WP_Error( 'invalid_google_token', 'Token Google inválido.', [ 'status' => 401 ] );
        }

        $data = json_decode( wp_remote_retrieve_body( $resp ), true );
        if ( ! is_array( $data ) || empty( $data['email'] ) ) {
            return new WP_Error( 'invalid_google_payload', 'Resposta do Google inválida.', [ 'status' => 401 ] );
        }

        // Confirma que o token foi emitido para nosso client_id e que o e-mail é verificado
        if ( ( $data['aud'] ?? '' ) !== $client_id ) {
            return new WP_Error( 'audience_mismatch', 'Client ID não corresponde.', [ 'status' => 401 ] );
        }
        if ( ( $data['email_verified'] ?? '' ) !== 'true' && ( $data['email_verified'] ?? false ) !== true ) {
            return new WP_Error( 'email_not_verified', 'E-mail Google não verificado.', [ 'status' => 401 ] );
        }

        $email      = sanitize_email( $data['email'] );
        $given_name = sanitize_text_field( $data['given_name'] ?? '' );
        $family     = sanitize_text_field( $data['family_name'] ?? '' );
        $full_name  = sanitize_text_field( $data['name'] ?? trim( $given_name . ' ' . $family ) );

        // Encontra ou cria o usuário
        $user = get_user_by( 'email', $email );
        if ( ! $user ) {
            $password = wp_generate_password( 32, true, true );
            $user_id  = wc_create_new_customer( $email, $email, $password, [
                'first_name' => $given_name,
                'last_name'  => $family,
            ] );
            if ( is_wp_error( $user_id ) ) {
                return new WP_Error( 'register_failed', $user_id->get_error_message(), [ 'status' => 500 ] );
            }
            update_user_meta( $user_id, 'biju_google_sub', sanitize_text_field( $data['sub'] ?? '' ) );
            if ( $full_name ) {
                wp_update_user( [ 'ID' => $user_id, 'display_name' => $full_name ] );
            }
            $user = get_user_by( 'id', $user_id );
        } else {
            // Atualiza o sub do Google se ainda não estiver salvo
            if ( ! get_user_meta( $user->ID, 'biju_google_sub', true ) && ! empty( $data['sub'] ) ) {
                update_user_meta( $user->ID, 'biju_google_sub', sanitize_text_field( $data['sub'] ) );
            }
        }

        return new WP_REST_Response( [
            'token' => Biju_Auth::generate_token( $user->ID ),
            'user'  => self::format_user( $user ),
        ], 200 );
    }

    /**
     * Config pública do Meta Pixel (somente Pixel ID, nunca o access token).
     */
    public static function meta_config(): WP_REST_Response {
        return new WP_REST_Response( Biju_Meta_Pixel::get_public_config(), 200 );
    }

    /**
     * Recebe um evento do navegador e replica via CAPI (server-side).
     * O frontend já dispara o pixel; isto garante chegada via servidor com o
     * mesmo event_id para o Meta deduplicar.
     */
    public static function meta_track( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $body = $request->get_json_params();
        if ( empty( $body['event_name'] ) ) {
            return new WP_Error( 'missing_event_name', 'event_name é obrigatório.', [ 'status' => 400 ] );
        }
        $result = Biju_Meta_Pixel::track_browser_event( $body );
        $status = ! empty( $result['success'] ) ? 200 : 422;
        return new WP_REST_Response( $result, $status );
    }

    /**
     * Devolve a public key do Mercado Pago (modo prod ou sandbox conforme config do plugin MP).
     * Lê das opções do plugin oficial woo-mercado-pago.
     */
    public static function payment_config(): WP_REST_Response {
        $public_key = '';

        // Determina sandbox/prod a partir das opções do plugin MP
        $is_sandbox = get_option( '_mp_checkout_test_mode', '' );
        $is_test    = ( $is_sandbox === 'yes' || $is_sandbox === '1' );

        if ( $is_test ) {
            $public_key = (string) get_option( '_mp_public_key_test', '' );
        }
        if ( ! $public_key ) {
            $public_key = (string) get_option( '_mp_public_key_prod', '' );
        }
        // Fallback antigo (versões anteriores do plugin)
        if ( ! $public_key ) {
            $public_key = (string) get_option( '_mp_public_key', '' );
        }

        return new WP_REST_Response( [
            'mp_public_key' => $public_key ?: null,
            'mp_sandbox'    => $is_test,
        ], 200 );
    }

    /**
     * Devolve o Client ID público do Google para o frontend inicializar o GIS.
     */
    public static function google_config(): WP_REST_Response {
        $client_id = self::resolve_google_client_id();
        return new WP_REST_Response( [
            'enabled'   => $client_id !== '',
            'client_id' => $client_id,
        ], 200 );
    }

    /**
     * Mostra de QUAL fonte o Client ID está vindo. Mascarado por segurança:
     * só mostra os 12 primeiros caracteres + os últimos 4. Útil para
     * verificar se o Site Kit está fornecendo o Client ID.
     */
    public static function google_debug(): WP_REST_Response {
        global $wpdb;

        $mask = function ( string $v ): string {
            if ( $v === '' ) return '';
            $len = strlen( $v );
            if ( $len <= 16 ) return $v;
            return substr( $v, 0, 12 ) . '...' . substr( $v, -8 );
        };

        // Lista TODAS as options do Site Kit + Nextend, mostrando as chaves
        // de cada uma. Isso revela onde o Client ID realmente está salvo.
        $rows = $wpdb->get_results(
            "SELECT option_name FROM {$wpdb->options}
             WHERE option_name LIKE 'googlesitekit%'
                OR option_name LIKE '%sign_in_with_google%'
                OR option_name LIKE 'nsl%'
                OR option_name LIKE 'nslp%'
             ORDER BY option_name",
            ARRAY_A
        );

        $options_map = [];
        foreach ( (array) $rows as $row ) {
            $name = $row['option_name'];
            $val  = get_option( $name );
            if ( is_array( $val ) ) {
                // Procura recursivamente por um valor que pareça um Client ID Google
                $found_cid = null;
                array_walk_recursive( $val, function ( $v, $k ) use ( &$found_cid ) {
                    if ( $found_cid !== null ) return;
                    if ( is_string( $v ) && preg_match( '/^\d{10,}-[a-z0-9]+\.apps\.googleusercontent\.com$/i', $v ) ) {
                        $found_cid = $v;
                    }
                } );
                $options_map[ $name ] = [
                    'type'     => 'array',
                    'keys'     => array_keys( $val ),
                    'client_id_found' => $found_cid ? substr( $found_cid, 0, 12 ) . '...' : null,
                ];
            } else {
                $is_cid = is_string( $val ) && preg_match( '/\.apps\.googleusercontent\.com$/i', $val );
                $options_map[ $name ] = [
                    'type'   => 'scalar',
                    'sample' => $is_cid
                        ? substr( $val, 0, 12 ) . '...'
                        : ( is_string( $val ) ? substr( $val, 0, 60 ) : gettype( $val ) ),
                ];
            }
        }

        $resolved = self::resolve_google_client_id();

        return new WP_REST_Response( [
            'resolved_client_id' => $mask( $resolved ),
            'resolved_found'     => $resolved !== '',
            'options_scanned'    => count( $options_map ),
            'options'            => $options_map,
        ], 200 );
    }

    /**
     * Resolve o Google OAuth Client ID procurando em ordem:
     *   1. Opção dedicada do nosso plugin (biju_google_client_id)
     *   2. Google Site Kit (módulo "Sign In With Google")
     *   3. Filtro `biju_google_client_id` para sites com configurações custom
     *
     * Permite reaproveitar o Client ID já configurado em outros plugins sem
     * precisar duplicar a configuração.
     */
    private static function resolve_google_client_id(): string {
        $candidates = [
            trim( (string) get_option( 'biju_google_client_id', '' ) ),
        ];

        // Nextend Social Login — Google Provider.
        // Versões recentes guardam as configs em "nsl_google_settings" como array
        // serializado com a chave 'client_id'.
        $nsl = get_option( 'nsl_google_settings' );
        if ( is_array( $nsl ) && ! empty( $nsl['client_id'] ) ) {
            $candidates[] = trim( (string) $nsl['client_id'] );
        }
        // Versão Pro do Nextend usa o prefixo "nslp_"
        $nslp = get_option( 'nslp_google_settings' );
        if ( is_array( $nslp ) && ! empty( $nslp['client_id'] ) ) {
            $candidates[] = trim( (string) $nslp['client_id'] );
        }

        // Google Site Kit (módulo Sign In With Google). A option real usa
        // hífens ("sign-in-with-google"), não underscores.
        $sitekit = get_option( 'googlesitekit_sign-in-with-google_settings' );
        if ( is_array( $sitekit ) && ! empty( $sitekit['clientID'] ) ) {
            $candidates[] = trim( (string) $sitekit['clientID'] );
        }
        // Fallback para versões/instalações que usem underscore
        $sitekit_alt = get_option( 'googlesitekit_sign_in_with_google_settings' );
        if ( is_array( $sitekit_alt ) && ! empty( $sitekit_alt['clientID'] ) ) {
            $candidates[] = trim( (string) $sitekit_alt['clientID'] );
        }
        $sitekit_legacy = (string) get_option( 'googlesitekit_sign_in_with_google_client_id', '' );
        if ( $sitekit_legacy ) {
            $candidates[] = trim( $sitekit_legacy );
        }

        $client_id = '';
        foreach ( $candidates as $c ) {
            if ( $c !== '' ) { $client_id = $c; break; }
        }

        return (string) apply_filters( 'biju_google_client_id', $client_id );
    }

    public static function get_account( WP_REST_Request $request ): WP_REST_Response {
        $user_id  = Biju_Auth::get_user_from_request( $request );
        $user     = get_user_by( 'id', $user_id );
        $customer = new WC_Customer( $user_id );

        $billing  = $customer->get_billing();
        $shipping = $customer->get_shipping();

        // CPF/CNPJ: WooCommerce não tem campo nativo. Lê dos metas do usuário
        // (gravado pelo Biju_Orders ao criar pedido).
        $cpf = get_user_meta( $user_id, 'billing_cpf', true )
            ?: get_user_meta( $user_id, '_billing_cpf', true )
            ?: get_user_meta( $user_id, 'cpf', true );

        if ( ! $cpf ) {
            // Fallback: pega do último pedido do cliente.
            $orders = wc_get_orders( [
                'customer_id' => $user_id,
                'limit'       => 1,
                'orderby'     => 'date',
                'order'       => 'DESC',
            ] );
            if ( ! empty( $orders[0] ) ) {
                $last_order = $orders[0];
                $cpf = $last_order->get_meta( '_billing_cpf' ) ?: $last_order->get_meta( '_cpf' ) ?: '';
                // Se o endereço de billing/shipping do customer estiver vazio,
                // herda do último pedido para pré-preencher o checkout.
                if ( empty( $billing['address_1'] ) ) {
                    $billing = array_merge( $billing, [
                        'first_name' => $last_order->get_billing_first_name(),
                        'last_name'  => $last_order->get_billing_last_name(),
                        'phone'      => $last_order->get_billing_phone(),
                        'address_1'  => $last_order->get_billing_address_1(),
                        'address_2'  => $last_order->get_billing_address_2(),
                        'city'       => $last_order->get_billing_city(),
                        'state'      => $last_order->get_billing_state(),
                        'postcode'   => $last_order->get_billing_postcode(),
                    ] );
                }
                if ( empty( $shipping['address_1'] ) ) {
                    $shipping = array_merge( $shipping, [
                        'first_name' => $last_order->get_shipping_first_name() ?: $last_order->get_billing_first_name(),
                        'last_name'  => $last_order->get_shipping_last_name() ?: $last_order->get_billing_last_name(),
                        'address_1'  => $last_order->get_shipping_address_1() ?: $last_order->get_billing_address_1(),
                        'address_2'  => $last_order->get_shipping_address_2() ?: $last_order->get_billing_address_2(),
                        'city'       => $last_order->get_shipping_city() ?: $last_order->get_billing_city(),
                        'state'      => $last_order->get_shipping_state() ?: $last_order->get_billing_state(),
                        'postcode'   => $last_order->get_shipping_postcode() ?: $last_order->get_billing_postcode(),
                    ] );
                }
            }
        }

        // Anexa CPF no billing pra simplificar o consumo do frontend.
        $billing['cpf'] = (string) $cpf;

        return new WP_REST_Response( [
            'user'     => self::format_user( $user ),
            'billing'  => $billing,
            'shipping' => $shipping,
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
