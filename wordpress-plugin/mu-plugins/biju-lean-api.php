<?php
/**
 * Plugin Name: Biju Lean API (desativa plugins desnecessários nas rotas /biju/v1)
 * Description: Nas requisições à API headless (/wp-json/biju/v1/*), remove da lista de
 *              plugins ativos um conjunto CONSERVADOR de plugins de analytics/tracking/
 *              feeds que não expõem classes a terceiros e não participam do checkout.
 *              Eles continuam ativos no resto do site. Objetivo: reduzir o tempo de boot
 *              (~1,7-2,0s medido no X-Biju-Phases) que toda request que fura o edge cache paga.
 *
 * INSTALAÇÃO: copiar para  wp-content/mu-plugins/biju-lean-api.php
 *             (NÃO em wp-content/plugins/mu-plugins/ — tem de ser irmã de plugins/)
 *
 * DESLIGAR EM EMERGÊNCIA: renomeie o arquivo para biju-lean-api.php.off
 *             OU defina no wp-config.php:  define( 'BIJU_LEAN_API_DISABLED', true );
 *
 * SEGURANÇA / PORQUÊ CONSERVADOR:
 *   Desativar plugins que registram autoloaders ou classes compartilhadas (Jetpack,
 *   JetEngine, Yoast, gateways de pagamento) no meio do boot causa "Class not found"
 *   fatal em outros plugins que dependem deles. Por isso a lista abaixo contém APENAS
 *   plugins de marketing/analytics/feed que são folhas na árvore de dependência:
 *   ninguém depende deles para carregar. Começamos seguro; dá para expandir testando
 *   um a um e medindo com o X-Biju-* depois.
 */

defined( 'ABSPATH' ) || exit;

// Kill-switch global (defina no wp-config.php para desligar sem mexer no arquivo).
if ( defined( 'BIJU_LEAN_API_DISABLED' ) && BIJU_LEAN_API_DISABLED ) {
	return;
}

/**
 * Estamos numa request da API headless do Biju? Decidido cedo, só pela URL.
 */
function biju_lean_is_api_request(): bool {
	$uri = $_SERVER['REQUEST_URI'] ?? '';
	return strpos( $uri, '/biju/v1/' ) !== false;
}

/**
 * É o webhook do Mercado Pago? Não enxugamos nada nele (precisa reconciliar pedido).
 */
function biju_lean_is_mp_webhook(): bool {
	$uri = $_SERVER['REQUEST_URI'] ?? '';
	return strpos( $uri, '/biju/v1/mp-webhook' ) !== false;
}

/**
 * Lista CONSERVADORA de slugs (pasta do plugin) seguros para remover na API.
 * Somente analytics/tracking/feeds/admin-tools que são "folhas" — nenhum outro
 * plugin depende deles para carregar suas classes.
 *
 * Deliberadamente NÃO incluídos (ficam ativos por segurança):
 *   - jetpack, jet-engine            → registram autoloaders/classes usados por terceiros
 *   - wordpress-seo(-premium)        → idem; e hooka muito cedo
 *   - woocommerce, *-mercadopago,
 *     pix-por-piggly, woocommerce-payments, campos BR, plugins de frete → checkout/catálogo
 *   - redis-cache, biju-shop-connector, carrinho-abandonado → infra/essencial
 *   - wp-mail-smtp                   → transporte do e-mail "novo pedido" (background)
 */
function biju_lean_disposable_slugs(): array {
	return [
		'microsoft-clarity',                        // heatmap/analytics — só front nativo
		'tiktok-for-business',                      // pixel TikTok
		'feed-a23-facebook',                        // feed de catálogo p/ Facebook
		'woocommerce-google-analytics-integration', // GA — tracking
		'ewww-image-optimizer',                     // otimiza imagem no upload/admin
		'wp-mail-logging',                          // só registra e-mails enviados
		'woo-order-export-lite',                    // exportação manual no admin
		'woo-update-manager',                       // checagem de updates
		'notifications-woocommerce',                // notificações no admin
	];
}

if ( biju_lean_is_api_request() && ! biju_lean_is_mp_webhook() ) {

	add_filter( 'option_active_plugins', function ( $plugins ) {
		if ( ! is_array( $plugins ) ) {
			return $plugins;
		}

		$drop = array_flip( biju_lean_disposable_slugs() );

		$filtered = array_values( array_filter( $plugins, function ( $entry ) use ( $drop ) {
			if ( ! is_string( $entry ) ) {
				return true; // não mexe em entradas inesperadas
			}
			// $entry vem como "slug/arquivo.php" ou "arquivo.php".
			$slug = strstr( $entry, '/', true );
			if ( $slug === false ) {
				$slug = basename( $entry, '.php' );
			}
			return ! isset( $drop[ $slug ] );
		} ) );

		// Salvaguarda: se por algum motivo a filtragem esvaziar a lista (estado
		// inesperado), devolve a original — nunca derruba o boot.
		return ! empty( $filtered ) ? $filtered : $plugins;
	}, 1 );
}
