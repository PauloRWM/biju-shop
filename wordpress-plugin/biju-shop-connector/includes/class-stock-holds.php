<?php
defined( 'ABSPATH' ) || exit;

/**
 * Reserva ("hold") de estoque por carrinho.
 *
 * Regra do cliente (2026-07): ao adicionar um produto ao carrinho (simples ou
 * variação) o estoque já é DESCONTADO; volta quando o carrinho é removido. Sem
 * liberação por tempo de inatividade (decisão do cliente).
 *
 * CHAVE = id da linha do carrinho abandonado (wc_abandoned_carts.id), NÃO o
 * identificador (user/email/phone). Motivo: o identificador MUDA na mesma sessão
 * (telefone → email → login), o que duplicava o hold e vazava o antigo. O id da
 * linha é estável (o find_existing_id sempre reaproveita a mesma linha).
 *
 * Devolução do estoque acontece em TODOS os caminhos em que a linha some:
 *  - exclusão manual no plugin (handlers AJAX substituídos aqui);
 *  - carrinho esvaziado (save vazio → release);
 *  - checkout (create_order libera antes de o pedido reservar/baixar);
 *  - pedido pago (on_order_paid libera — evita baixar 2x);
 *  - QUALQUER outra via (cron de limpeza, criar-pedido-pelo-plugin, etc.):
 *    coberto por um cron de RECONCILIAÇÃO que devolve o estoque de holds cujo
 *    cart_id não existe mais na tabela de abandonados. Não é release por tempo;
 *    é "o carrinho sumiu → devolve".
 *
 * Kill-switch: option `biju_cart_stock_hold` (default 1). 0 desliga o desconto.
 */
class Biju_Stock_Holds {

	const OPTION_ENABLED    = 'biju_cart_stock_hold';
	const OPTION_DB_VERSION = 'biju_stock_holds_db_version';
	const DB_VERSION        = '2';
	const RECONCILE_HOOK    = 'biju_stock_holds_reconcile';

	public static function init(): void {
		self::maybe_upgrade_table();

		add_action( 'init', function () {
			remove_action( 'wp_ajax_wc_ac_delete_cart', 'wc_ac_delete_cart' );
			remove_action( 'wp_ajax_wc_ac_delete_all_carts', 'wc_ac_delete_all_carts' );
			add_action( 'wp_ajax_wc_ac_delete_cart', [ __CLASS__, 'ajax_delete_cart' ] );
			add_action( 'wp_ajax_wc_ac_delete_all_carts', [ __CLASS__, 'ajax_delete_all_carts' ] );
		}, 20 );

		// Cron de reconciliação: devolve estoque de holds órfãos (cart sumiu por
		// qualquer via). Roda de hora em hora.
		add_action( self::RECONCILE_HOOK, [ __CLASS__, 'reconcile' ] );
		if ( ! wp_next_scheduled( self::RECONCILE_HOOK ) ) {
			wp_schedule_event( time() + 300, 'hourly', self::RECONCILE_HOOK );
		}
	}

	public static function enabled(): bool {
		return (bool) ( '1' === (string) get_option( self::OPTION_ENABLED, '1' ) );
	}

	private static function table(): string {
		global $wpdb;
		return $wpdb->prefix . 'biju_stock_holds';
	}

	private static function abandoned_table(): string {
		global $wpdb;
		return $wpdb->prefix . 'wc_abandoned_carts';
	}

	/**
	 * Cria/migra a tabela. v2 = chave por cart_id. Na migração de uma versão
	 * anterior (chave por ident), DEVOLVE todo o estoque ainda reservado e
	 * recria a tabela limpa — clean slate seguro (o hold será refeito no próximo
	 * save de cada carrinho ativo).
	 */
	private static function maybe_upgrade_table(): void {
		if ( self::DB_VERSION === (string) get_option( self::OPTION_DB_VERSION ) ) return;
		global $wpdb;
		$table = self::table();

		// Se já existe uma tabela antiga, devolve o estoque que ela ainda segura
		// antes de recriar (evita deixar estoque preso na migração).
		$exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) );
		if ( $exists ) {
			$rows = $wpdb->get_results( "SELECT product_id, variation_id, qty FROM {$table}", ARRAY_A );
			foreach ( (array) $rows as $r ) {
				self::credit_stock( (int) $r['product_id'], (int) $r['variation_id'], (int) $r['qty'] );
			}
			$wpdb->query( "DROP TABLE IF EXISTS {$table}" );
		}

		$charset = $wpdb->get_charset_collate();
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( "CREATE TABLE {$table} (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			cart_id BIGINT UNSIGNED NOT NULL,
			product_id BIGINT UNSIGNED NOT NULL,
			variation_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
			qty INT NOT NULL DEFAULT 0,
			updated_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY cart_prod (cart_id, product_id, variation_id),
			KEY cart_id (cart_id)
		) {$charset};" );

		update_option( self::OPTION_DB_VERSION, self::DB_VERSION );
	}

	private static function stock_target( int $product_id, int $variation_id ) {
		if ( $variation_id ) {
			$var = wc_get_product( $variation_id );
			if ( $var && $var->managing_stock() ) return $var;
			$parent = wc_get_product( $product_id );
			if ( $parent && $parent->managing_stock() ) return $parent;
			return null;
		}
		$prod = wc_get_product( $product_id );
		if ( $prod && $prod->managing_stock() ) return $prod;
		return null;
	}

	/**
	 * Reconcilia a reserva deste carrinho (por cart_id) com os itens atuais.
	 *
	 * @param array<int,array{product_id:int,variation_id:int,quantity:int}> $items
	 */
	public static function hold_for_cart( int $cart_id, array $items ): void {
		if ( $cart_id <= 0 || ! self::enabled() ) return;
		global $wpdb;
		$table = self::table();

		$want = [];
		foreach ( $items as $it ) {
			$pid = (int) ( $it['product_id'] ?? 0 );
			$vid = (int) ( $it['variation_id'] ?? 0 );
			$qty = max( 0, (int) ( $it['quantity'] ?? 0 ) );
			if ( ! $pid || $qty <= 0 ) continue;
			if ( ! self::stock_target( $pid, $vid ) ) continue;
			$want[ $pid . ':' . $vid ] = [ 'product_id' => $pid, 'variation_id' => $vid, 'qty' => $qty ];
		}

		$have = [];
		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT product_id, variation_id, qty FROM {$table} WHERE cart_id = %d", $cart_id
		), ARRAY_A );
		foreach ( (array) $rows as $r ) {
			$have[ (int) $r['product_id'] . ':' . (int) $r['variation_id'] ] = (int) $r['qty'];
		}

		$now  = current_time( 'mysql' );
		$keys = array_unique( array_merge( array_keys( $want ), array_keys( $have ) ) );
		foreach ( $keys as $key ) {
			$old = $have[ $key ] ?? 0;
			$new = isset( $want[ $key ] ) ? $want[ $key ]['qty'] : 0;
			if ( $new === $old ) continue;
			[ $pid, $vid ] = array_map( 'intval', explode( ':', $key ) );

			if ( $new > $old ) {
				$target    = self::stock_target( $pid, $vid );
				$available = $target ? (int) $target->get_stock_quantity() : 0;
				$take      = max( 0, min( $new - $old, $available ) );
				$effective = $old + $take;
				if ( $take > 0 ) {
					wc_update_product_stock( $target, $take, 'decrease' );
				}
				if ( $effective > 0 ) {
					self::upsert( $cart_id, $pid, $vid, $effective, $now );
				}
				// $effective == 0 → nada a registrar (não cria linha de qty 0).
			} else {
				self::credit_stock( $pid, $vid, $old - $new );
				if ( $new > 0 ) {
					self::upsert( $cart_id, $pid, $vid, $new, $now );
				} else {
					$wpdb->delete( $table, [ 'cart_id' => $cart_id, 'product_id' => $pid, 'variation_id' => $vid ], [ '%d', '%d', '%d' ] );
				}
			}
		}
	}

	/** Libera toda a reserva de um carrinho (por cart_id) e devolve o estoque. */
	public static function release_for_cart( int $cart_id ): void {
		if ( $cart_id <= 0 ) return;
		global $wpdb;
		$table = self::table();
		$rows  = $wpdb->get_results( $wpdb->prepare(
			"SELECT product_id, variation_id, qty FROM {$table} WHERE cart_id = %d", $cart_id
		), ARRAY_A );
		if ( empty( $rows ) ) return;
		foreach ( $rows as $r ) {
			self::credit_stock( (int) $r['product_id'], (int) $r['variation_id'], (int) $r['qty'] );
		}
		$wpdb->delete( $table, [ 'cart_id' => $cart_id ], [ '%d' ] );
	}

	/** Libera as reservas de vários carrinhos (usado no checkout / pedido pago). */
	public static function release_for_carts( array $cart_ids ): void {
		foreach ( array_unique( array_map( 'intval', $cart_ids ) ) as $cid ) {
			self::release_for_cart( $cid );
		}
	}

	private static function credit_stock( int $product_id, int $variation_id, int $qty ): void {
		if ( $qty <= 0 ) return;
		$target = self::stock_target( $product_id, $variation_id );
		if ( $target ) {
			wc_update_product_stock( $target, $qty, 'increase' );
		}
	}

	private static function upsert( int $cart_id, int $pid, int $vid, int $qty, string $now ): void {
		global $wpdb;
		$table = self::table();
		$wpdb->query( $wpdb->prepare(
			"INSERT INTO {$table} (cart_id, product_id, variation_id, qty, updated_at)
			 VALUES (%d, %d, %d, %d, %s)
			 ON DUPLICATE KEY UPDATE qty = VALUES(qty), updated_at = VALUES(updated_at)",
			$cart_id, $pid, $vid, $qty, $now
		) );
	}

	/** @return array<string,int> mapa "pid:vid" => qty reservado por este carrinho. */
	public static function held_map( int $cart_id ): array {
		if ( $cart_id <= 0 ) return [];
		global $wpdb;
		$table = self::table();
		$rows  = $wpdb->get_results( $wpdb->prepare(
			"SELECT product_id, variation_id, qty FROM {$table} WHERE cart_id = %d", $cart_id
		), ARRAY_A );
		$map = [];
		foreach ( (array) $rows as $r ) {
			$map[ (int) $r['product_id'] . ':' . (int) $r['variation_id'] ] = (int) $r['qty'];
		}
		return $map;
	}

	/**
	 * Reconciliação: devolve o estoque de holds cujo carrinho não existe mais na
	 * tabela de abandonados (foi pago/limpo/removido por qualquer via sem passar
	 * pelos nossos hooks). Não mexe em holds cujo carrinho ainda existe.
	 */
	public static function reconcile(): void {
		global $wpdb;
		$table = self::table();
		$acart = self::abandoned_table();

		$orphans = $wpdb->get_col(
			"SELECT DISTINCT h.cart_id FROM {$table} h
			 LEFT JOIN {$acart} a ON a.id = h.cart_id
			 WHERE a.id IS NULL"
		);
		foreach ( (array) $orphans as $cid ) {
			self::release_for_cart( (int) $cid );
		}
	}

	// -------------------------------------------------------------------------
	// Handlers AJAX que substituem os do plugin carrinho-abandonado.
	// -------------------------------------------------------------------------

	public static function ajax_delete_cart(): void {
		check_ajax_referer( 'wc_ac_delete_cart_nonce', 'nonce' );
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_send_json_error( [ 'message' => 'Permissão negada.' ] );
		}
		$cart_id = isset( $_POST['cart_id'] ) ? intval( $_POST['cart_id'] ) : 0;
		if ( ! $cart_id ) {
			wp_send_json_error( [ 'message' => 'ID do carrinho inválido.' ] );
		}

		// Devolve o estoque reservado por este carrinho ANTES de apagar.
		self::release_for_cart( $cart_id );

		global $wpdb;
		$deleted = $wpdb->delete( self::abandoned_table(), [ 'id' => $cart_id ], [ '%d' ] );
		if ( $deleted === false ) {
			wp_send_json_error( [ 'message' => 'Erro ao excluir o registro.' ] );
		}
		if ( $deleted === 0 ) {
			wp_send_json_error( [ 'message' => 'Registro não encontrado.' ] );
		}
		wp_send_json_success( [
			'message' => 'Registro #' . $cart_id . ' excluído (estoque devolvido).',
			'cart_id' => $cart_id,
		] );
	}

	public static function ajax_delete_all_carts(): void {
		check_ajax_referer( 'wc_ac_delete_all_carts_nonce', 'nonce' );
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_send_json_error( [ 'message' => 'Permissão negada.' ] );
		}

		global $wpdb;
		$holds = self::table();
		$rows  = $wpdb->get_results( "SELECT product_id, variation_id, qty FROM {$holds}", ARRAY_A );
		foreach ( (array) $rows as $r ) {
			self::credit_stock( (int) $r['product_id'], (int) $r['variation_id'], (int) $r['qty'] );
		}
		$wpdb->query( "TRUNCATE TABLE {$holds}" );

		$result = $wpdb->query( 'TRUNCATE TABLE ' . self::abandoned_table() );
		if ( $result === false ) {
			wp_send_json_error( [ 'message' => 'Erro ao apagar os registros.' ] );
		}
		wp_send_json_success( [ 'message' => 'Todos os carrinhos apagados (estoque devolvido).' ] );
	}
}
