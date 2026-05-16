<?php
defined( 'ABSPATH' ) || exit;

/**
 * Newsletter / Captura de WhatsApp
 * Endpoint: POST /biju/v1/newsletter
 */
class Biju_Newsletter {

    /**
     * POST /biju/v1/newsletter
     * Salva o WhatsApp do cliente para newsletter
     */
    public static function subscribe( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $whatsapp = sanitize_text_field( $request->get_param( 'whatsapp' ) );

        if ( empty( $whatsapp ) ) {
            return new WP_Error( 'missing_whatsapp', 'WhatsApp é obrigatório.', [ 'status' => 400 ] );
        }

        // Validação básica de WhatsApp (apenas números, pode ter + no início)
        $clean_whatsapp = preg_replace( '/[^0-9+]/', '', $whatsapp );
        if ( strlen( $clean_whatsapp ) < 10 ) {
            return new WP_Error( 'invalid_whatsapp', 'WhatsApp inválido.', [ 'status' => 400 ] );
        }

        global $wpdb;
        $table = $wpdb->prefix . 'biju_newsletter';

        // Verifica se já existe
        $exists = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM $table WHERE whatsapp = %s",
            $clean_whatsapp
        ) );

        if ( $exists ) {
            return new WP_Error( 'already_subscribed', 'Este WhatsApp já está cadastrado.', [ 'status' => 409 ] );
        }

        // Insere novo registro
        $inserted = $wpdb->insert(
            $table,
            [
                'whatsapp'   => $clean_whatsapp,
                'created_at' => current_time( 'mysql' ),
                'status'     => 'active',
            ],
            [ '%s', '%s', '%s' ]
        );

        if ( ! $inserted ) {
            return new WP_Error( 'db_error', 'Erro ao salvar. Tente novamente.', [ 'status' => 500 ] );
        }

        return new WP_REST_Response( [
            'success' => true,
            'message' => 'WhatsApp cadastrado com sucesso! Você receberá nossas novidades.',
        ], 201 );
    }

    /**
     * Cria a tabela no banco de dados
     */
    public static function create_table(): void {
        global $wpdb;
        $table         = $wpdb->prefix . 'biju_newsletter';
        $charset       = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE IF NOT EXISTS $table (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            whatsapp varchar(20) NOT NULL,
            created_at datetime NOT NULL,
            status varchar(20) NOT NULL DEFAULT 'active',
            PRIMARY KEY (id),
            UNIQUE KEY whatsapp (whatsapp),
            KEY status (status),
            KEY created_at (created_at)
        ) $charset;";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta( $sql );
    }

    /**
     * Página de admin para visualizar inscritos
     */
    public static function render_page(): void {
        if ( ! current_user_can( 'manage_options' ) ) return;

        global $wpdb;
        $table = $wpdb->prefix . 'biju_newsletter';

        // Ação de exportar CSV
        if ( isset( $_GET['action'] ) && $_GET['action'] === 'export' && check_admin_referer( 'biju_export_newsletter' ) ) {
            self::export_csv();
            exit;
        }

        // Buscar inscritos
        $subscribers = $wpdb->get_results( "SELECT * FROM $table ORDER BY created_at DESC LIMIT 1000" );
        $total       = $wpdb->get_var( "SELECT COUNT(*) FROM $table" );
        $active      = $wpdb->get_var( "SELECT COUNT(*) FROM $table WHERE status = 'active'" );

        ?>
        <div class="wrap">
            <h1>Newsletter - WhatsApp</h1>
            
            <div class="notice notice-info" style="display:flex;align-items:center;gap:12px;padding:12px">
                <span class="dashicons dashicons-info" style="font-size:24px;color:#2271b1"></span>
                <div>
                    <strong>Total de inscritos:</strong> <?php echo number_format_i18n( $total ); ?> 
                    <span style="margin-left:20px"><strong>Ativos:</strong> <?php echo number_format_i18n( $active ); ?></span>
                </div>
            </div>

            <p>
                <a href="<?php echo wp_nonce_url( admin_url( 'admin.php?page=biju-newsletter&action=export' ), 'biju_export_newsletter' ); ?>" class="button button-primary">
                    <span class="dashicons dashicons-download" style="margin-top:3px"></span> Exportar CSV
                </a>
            </p>

            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th style="width:80px">ID</th>
                        <th>WhatsApp</th>
                        <th style="width:180px">Data de Cadastro</th>
                        <th style="width:100px">Status</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if ( empty( $subscribers ) ) : ?>
                        <tr>
                            <td colspan="4" style="text-align:center;padding:40px;color:#666">
                                Nenhum inscrito ainda.
                            </td>
                        </tr>
                    <?php else : ?>
                        <?php foreach ( $subscribers as $sub ) : ?>
                        <tr>
                            <td><?php echo esc_html( $sub->id ); ?></td>
                            <td>
                                <strong><?php echo esc_html( $sub->whatsapp ); ?></strong>
                                <a href="https://wa.me/<?php echo esc_attr( preg_replace( '/[^0-9]/', '', $sub->whatsapp ) ); ?>" target="_blank" style="margin-left:8px">
                                    <span class="dashicons dashicons-whatsapp" style="color:#25D366"></span>
                                </a>
                            </td>
                            <td><?php echo esc_html( date_i18n( 'd/m/Y H:i', strtotime( $sub->created_at ) ) ); ?></td>
                            <td>
                                <?php if ( $sub->status === 'active' ) : ?>
                                    <span style="color:#46b450">● Ativo</span>
                                <?php else : ?>
                                    <span style="color:#999">○ Inativo</span>
                                <?php endif; ?>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>

            <?php if ( $total > 1000 ) : ?>
                <p class="description">Mostrando os 1000 inscritos mais recentes. Use a exportação CSV para ver todos.</p>
            <?php endif; ?>
        </div>
        <?php
    }

    /**
     * Exporta inscritos para CSV
     */
    private static function export_csv(): void {
        global $wpdb;
        $table = $wpdb->prefix . 'biju_newsletter';
        $subscribers = $wpdb->get_results( "SELECT * FROM $table ORDER BY created_at DESC", ARRAY_A );

        header( 'Content-Type: text/csv; charset=utf-8' );
        header( 'Content-Disposition: attachment; filename=newsletter-whatsapp-' . date( 'Y-m-d' ) . '.csv' );

        $output = fopen( 'php://output', 'w' );
        
        // BOM para UTF-8
        fprintf( $output, chr(0xEF).chr(0xBB).chr(0xBF) );
        
        // Cabeçalho
        fputcsv( $output, [ 'ID', 'WhatsApp', 'Data de Cadastro', 'Status' ] );

        // Dados
        foreach ( $subscribers as $sub ) {
            fputcsv( $output, [
                $sub['id'],
                $sub['whatsapp'],
                date_i18n( 'd/m/Y H:i', strtotime( $sub['created_at'] ) ),
                $sub['status'],
            ] );
        }

        fclose( $output );
    }
}
