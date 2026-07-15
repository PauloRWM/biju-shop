<?php
/**
 * Plugin Name: Biju Lean API (desativa plugins desnecessários nas rotas /biju/v1)
 * Description: Nas requisições à API headless (/wp-json/biju/v1/*), remove da lista de
 *              plugins ativos tudo que NÃO é essencial para a API responder (tracking,
 *              SEO, feeds de anúncio, automações, otimizador de imagem, etc.). Esses
 *              plugins continuam ativos normalmente no resto do site (admin, checkout
 *              nativo, páginas). O objetivo é cortar o tempo de boot (~1,7-2,0s medido
 *              no X-Biju-Phases) que toda request que fura o edge cache paga hoje.
 *
 * INSTALAÇÃO: copiar para wp-content/mu-plugins/biju-lean-api.php
 *             (mu-plugins carregam sozinhos; precisam ficar na RAIZ dessa pasta).
 *
 * SEGURANÇA: a filtragem só ocorre quando a URL começa em /wp-json/biju/v1/. Qualquer
 *            outra URL (loja, admin, wp-cron, webhooks de outros plugins) NÃO é afetada.
 *            O webhook do Mercado Pago (/biju/v1/mp-webhook) é tratado como exceção e
 *            mantém o plugin do MP carregado, pois precisa dele para reconciliar pedidos.
 */

defined( 'ABSPATH' ) || exit;

/**
 * Estamos numa request da API headless do Biju? (decidido cedo, sem depender do WP)
 */
function biju_lean_is_api_request(): bool {
	$uri = $_SERVER['REQUEST_URI'] ?? '';
	return strpos( $uri, '/biju/v1/' ) !== false;
}

/**
 * É o webhook do Mercado Pago? Esse precisa do plugin do MP carregado para
 * reconciliar o pedido — não podemos enxugar tão agressivamente.
 */
function biju_lean_is_mp_webhook(): bool {
	$uri = $_SERVER['REQUEST_URI'] ?? '';
	return strpos( $uri, '/biju/v1/mp-webhook' ) !== false;
}

/**
 * É uma rota que cria/processa pedido ou mexe em pagamento? Aí precisamos manter
 * WooCommerce + gateways + campos BR + frete. As rotas de leitura de catálogo
 * (products/categories/homepage) não precisam de nada disso para serializar.
 */
function biju_lean_needs_commerce(): bool {
	$uri = $_SERVER['REQUEST_URI'] ?? '';
	// Rotas que tocam pedido/pagamento/conta/carrinho/frete/cupom.
	return (bool) preg_match(
		'#/biju/v1/(orders|account|cart|coupon|shipping|payment-config|mp-webhook)#',
		$uri
	);
}

/**
 * Slugs (pasta do plugin) que NUNCA são necessários para a API headless responder.
 * São puramente de marketing/SEO/analytics/automação no front nativo ou no admin.
 *
 * Mantemos deliberadamente FORA desta lista (ou seja, continuam carregando):
 *   woocommerce, woocommerce-mercadopago, pix-por-piggly, woocommerce-payments,
 *   woocommerce-extra-checkout-fields-for-brazil, mandabem e demais de frete,
 *   redis-cache, biju-shop-connector, carrinho-abandonado.
 */
function biju_lean_disposable_slugs(): array {
	return [
		'jetpack',
		'jet-engine',
		'microsoft-clarity',
		'tiktok-for-business',
		'feed-a23-facebook',
		'google-listings-and-ads',
		'google-site-kit',
		'suretriggers',
		'ewww-image-optimizer',
		'wordpress-seo-premium',
		'wordpress-seo',
		'woocommerce-google-analytics-integration',
		'notifications-woocommerce',
		'woo-order-export-lite',
		'woo-update-manager',
		'wp-mail-logging',
		// wp-mail-smtp NÃO entra: o e-mail "novo pedido" agora roda em background,
		// mas o handler ainda usa o transporte SMTP — manter para garantir entrega.
	];
}

/**
 * Slugs adicionais que dá para remover quando a rota é SÓ leitura de catálogo
 * (não precisa nem do WooCommerce inteiro para serializar, mas o connector e o
 * Woo são leves o suficiente; aqui removemos só o que claramente não usamos).
 */
function biju_lean_catalog_extra_disposable(): array {
	return [
		'woocommerce-payments',          // gateway internacional — catálogo não usa
		'pix-por-piggly',                // PIX — só importa no checkout
	];
}

if ( biju_lean_is_api_request() ) {

	add_filter( 'option_active_plugins', function ( $plugins ) {
		if ( ! is_array( $plugins ) ) {
			return $plugins;
		}

		$drop = biju_lean_disposable_slugs();

		// Em rotas que NÃO mexem em comércio (só leitura de catálogo), podemos
		// remover também os gateways de pagamento que o catálogo nunca usa.
		if ( ! biju_lean_needs_commerce() && ! biju_lean_is_mp_webhook() ) {
			$drop = array_merge( $drop, biju_lean_catalog_extra_disposable() );
		}

		$drop = array_flip( $drop );

		return array_values( array_filter( $plugins, function ( $entry ) use ( $drop ) {
			// $entry vem como "slug/arquivo.php" ou "arquivo.php".
			$slug = strstr( $entry, '/', true );
			if ( $slug === false ) {
				$slug = basename( $entry, '.php' );
			}
			return ! isset( $drop[ $slug ] );
		} ) );
	}, 1 );

	// Alguns plugins (ex: Yoast, Jetpack) também se registram via sitewide em
	// multisite. Filtra lá também por segurança (no-op em single site).
	add_filter( 'site_option_active_sitewide_plugins', function ( $plugins ) {
		if ( ! is_array( $plugins ) ) {
			return $plugins;
		}
		$drop = array_flip( biju_lean_disposable_slugs() );
		foreach ( array_keys( $plugins ) as $entry ) {
			$slug = strstr( $entry, '/', true );
			if ( $slug === false ) {
				$slug = basename( $entry, '.php' );
			}
			if ( isset( $drop[ $slug ] ) ) {
				unset( $plugins[ $entry ] );
			}
		}
		return $plugins;
	}, 1 );
}
