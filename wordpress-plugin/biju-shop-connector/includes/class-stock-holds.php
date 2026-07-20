<?php
defined( 'ABSPATH' ) || exit;

/**
 * Reserva ("hold") de estoque por carrinho.
 *
 * Regra do cliente (2026-07): quando um usuário adiciona um produto ao carrinho
 * (simples ou variação), o estoque já é DESCONTADO. O estoque só volta quando o
 * carrinho é excluído no plugin de carrinho abandonado (exclusão manual) — NÃO
 * há liberação automática por tempo (decisão explícita do cliente).
 *
 * Como funciona sem furar / sem baixar 2x:
 *  - Mantemos um livro-razão próprio ({prefix}biju_stock_holds) com quanto cada
 *    carrinho (identificado por user/email/phone) está segurando de cada produto.
 *    É a NOSSA fonte da verdade do que foi descontado — desacoplada da tabela do
 *    plugin de terceiros (wc_abandoned_carts).
 *  - O carrinho só existe no servidor quando é salvo (logado, ou guest após
 *    informar email/phone). Anônimo puro não segura estoque (não há o que excluir).
 *  - No checkout (create_order) a reserva é LIBERADA antes de o pedido reservar/
 *    baixar pelo fluxo normal do Woo → nunca baixa 2x, e o próprio dono não é
 *    barrado pela checagem de estoque (o estoque volta ao normal um instante
 *    antes de o pedido reservar).
 *  - Exclusão manual (1 carrinho ou "excluir todos") no plugin → devolvemos o
 *    estoque. Interceptamos os handlers AJAX do plugin (que apagavam a linha sem
 *    hook nenhum).
 *
 * Kill-switch: option `biju_cart_stock_hold` (default 1). Setar 0 desliga todo o
 * desconto no add (para casos de emergência), sem precisar de deploy.
 */
class Biju_Stock_Holds {

	const OPTION_ENABLED   = 'biju_cart_stock_hold';
	const OPTION_DB_VERSION = 'biju_stock_holds_db_version';
	const DB_VERSION        = '1';

	public static function init(): void {
		self::maybe_create_table();

		// Substitui os handlers de exclusão do plugin carrinho-abandonado para
		// devolver o estoque ANTES de apagar. Os originais apagam a linha direto
		// no banco, sem disparar hook. Feito no init (admin-ajax dispara init).
		add_action( 'init', function () {
			remove_action( 'wp_ajax_wc_ac_delete_cart', 'wc_ac_delete_cart' );
			remove_action( 'wp_ajax_wc_ac_delete_all_carts', 'wc_ac_delete_all_carts' );
			add_action( 'wp_ajax_wc_ac_delete_cart', [ __CLASS__, 'ajax_delete_cart' ] );
			add_action( 'wp_ajax_wc_ac_delete_all_carts', [ __CLASS__, 'ajax_delete_all_carts' ] );
		}, 20 );
	}

	public static function enabled(): bool {
		return (bool) ( '1' === (string) get_option( self::OPTION_ENABLED, '1' ) );
	}

	private static function table(): string {
		global $wpdb;
		return $wpdb->prefix . 'biju_stock_holds';
	}

	private static function maybe_create_table(): void {
		if ( self::DB_VERSION === (string) get_option( self::OPTION_DB_VERSION ) ) return;
		global $wpdb;
		$table   = self::table();
		$charset = $wpdb->get_charset_collate();
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( "CREATE TABLE {$table} (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			ident VARCHAR(191) NOT NULL,
			product_id BIGINT UNSIGNED NOT NULL,
			variation_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
			qty INT NOT NULL DEFAULT 0,
			updated_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY ident_prod (ident, product_id, variation_id),
			KEY ident (ident)
		) {$charset};" );
		update_option( self::OPTION_DB_VERSION, self::DB_VERSION );
	}

	/**
	 * Identificador canônico do carrinho (mesma prioridade do abandoned-cart:
	 * user > email > phone). Uma reserva física por carrinho lógico.
	 */
	public static function ident( int $user_id, string $email = '', string $phone = '' ): string {
		if ( $user_id > 0 ) return 'u:' . $user_id;
		if ( $email !== '' ) return 'e:' . strtolower( $email );
		if ( $phone !== '' ) return 'p:' . preg_replace( '/\D/', '', $phone );
		return '';
	}

	/**
	 * Produto que realmente gerencia estoque para o par (product, variation).
	 * Retorna o WC_Product a debitar/creditar, ou null se ninguém gerencia
	 * estoque (estoque ilimitado → não mexemos).
	 */
	private static function stock_target( int $product_id, int $variation_id ) {
		if ( $variation_id ) {
			$var = wc_get_product( $variation_id );
			if ( $var && $var->managing_stock() ) return $var;
			// Variação sem estoque próprio → herda do pai.
			$parent = wc_get_product( $product_id );
			if ( $parent && $parent->managing_stock() ) return $parent;
			return null;
		}
		$prod = wc_get_product( $product_id );
		if ( $prod && $prod->managing_stock() ) return $prod;
		return null;
	}

	/**
	 * Reconcilia a reserva deste carrinho com os itens atuais: debita o que
	 * aumentou, credita o que diminuiu/saiu. Chamado a cada save do carrinho.
	 *
	 * @param array<int,array{product_id:int,variation_id:int,quantity:int}> $items
	 */
	public static function hold_for_cart( string $ident, array $items ): void {
		if ( $ident === '' || ! self::enabled() ) return;
		global $wpdb;
		$table = self::table();

		// Mapa desejado (só produtos que gerenciam estoque).
		$want = [];
		foreach ( $items as $it ) {
			$pid = (int) ( $it['product_id'] ?? 0 );
			$vid = (int) ( $it['variation_id'] ?? 0 );
			$qty = max( 0, (int) ( $it['quantity'] ?? 0 ) );
			if ( ! $pid || $qty <= 0 ) continue;
			if ( ! self::stock_target( $pid, $vid ) ) continue; // ilimitado → ignora
			$want[ $pid . ':' . $vid ] = [ 'product_id' => $pid, 'variation_id' => $vid, 'qty' => $qty ];
		}

		// Mapa atual (o que já está reservado por este carrinho).
		$have = [];
		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT product_id, variation_id, qty FROM {$table} WHERE ident = %s", $ident
		), ARRAY_A );
		foreach ( (array) $rows as $r ) {
			$have[ (int) $r['product_id'] . ':' . (int) $r['variation_id'] ] = (int) $r['qty'];
		}

		$now  = current_time( 'mysql' );
		$keys = array_unique( array_merge( array_keys( $want ), array_keys( $have ) ) );
		foreach ( $keys as $key ) {
			$old  = $have[ $key ] ?? 0;
			$new  = isset( $want[ $key ] ) ? $want[ $key ]['qty'] : 0;
			if ( $new === $old ) continue;
			[ $pid, $vid ] = array_map( 'intval', explode( ':', $key ) );

			if ( $new > $old ) {
				// Debita a diferença — mas nunca abaixo de 0. Se o estoque não
				// cobre tudo, segura só o que dá (o resto é tratado no checkout
				// pelo diálogo de estoque).
				$target    = self::stock_target( $pid, $vid );
				$available = $target ? (int) $target->get_stock_quantity() : 0;
				$take      = max( 0, min( $new - $old, $available ) );
				$effective = $old + $take;
				if ( $take > 0 ) {
					wc_update_product_stock( $target, $take, 'decrease' );
				}
				self::upsert( $ident, $pid, $vid, $effective, $now );
			} else {
				// Devolve a diferença.
				$give = $old - $new;
				self::credit_stock( $pid, $vid, $give );
				if ( $new > 0 ) {
					self::upsert( $ident, $pid, $vid, $new, $now );
				} else {
					$wpdb->delete( $table, [ 'ident' => $ident, 'product_id' => $pid, 'variation_id' => $vid ], [ '%s', '%d', '%d' ] );
				}
			}
		}
	}

	/**
	 * Libera TODA a reserva deste carrinho e devolve o estoque. Usado no checkout
	 * (antes de o pedido reservar/baixar) e na exclusão manual do carrinho.
	 */
	public static function release_for_cart( string $ident ): void {
		if ( $ident === '' ) return;
		global $wpdb;
		$table = self::table();
		$rows  = $wpdb->get_results( $wpdb->prepare(
			"SELECT product_id, variation_id, qty FROM {$table} WHERE ident = %s", $ident
		), ARRAY_A );
		if ( empty( $rows ) ) return;
		foreach ( $rows as $r ) {
			self::credit_stock( (int) $r['product_id'], (int) $r['variation_id'], (int) $r['qty'] );
		}
		$wpdb->delete( $table, [ 'ident' => $ident ], [ '%s' ] );
	}

	/** Soma de volta ao estoque (crédito). */
	private static function credit_stock( int $product_id, int $variation_id, int $qty ): void {
		if ( $qty <= 0 ) return;
		$target = self::stock_target( $product_id, $variation_id );
		if ( $target ) {
			wc_update_product_stock( $target, $qty, 'increase' );
		}
	}

	private static function upsert( string $ident, int $pid, int $vid, int $qty, string $now ): void {
		global $wpdb;
		$table = self::table();
		// INSERT ... ON DUPLICATE KEY UPDATE (chave única ident_prod).
		$wpdb->query( $wpdb->prepare(
			"INSERT INTO {$table} (ident, product_id, variation_id, qty, updated_at)
			 VALUES (%s, %d, %d, %d, %s)
			 ON DUPLICATE KEY UPDATE qty = VALUES(qty), updated_at = VALUES(updated_at)",
			$ident, $pid, $vid, $qty, $now
		) );
	}

	/**
	 * Quanto este carrinho segura de um item (para o get_saved/recover não
	 * barrarem o próprio dono ao recuperar um item que ele mesmo reservou).
	 * @return array<string,int> mapa "pid:vid" => qty
	 */
	public static function held_map( string $ident ): array {
		if ( $ident === '' ) return [];
		global $wpdb;
		$table = self::table();
		$rows  = $wpdb->get_results( $wpdb->prepare(
			"SELECT product_id, variation_id, qty FROM {$table} WHERE ident = %s", $ident
		), ARRAY_A );
		$map = [];
		foreach ( (array) $rows as $r ) {
			$map[ (int) $r['product_id'] . ':' . (int) $r['variation_id'] ] = (int) $r['qty'];
		}
		return $map;
	}

	// -------------------------------------------------------------------------
	// Handlers AJAX que substituem os do plugin carrinho-abandonado, devolvendo
	// o estoque antes de apagar a linha.
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

		global $wpdb;
		$table = $wpdb->prefix . 'wc_abandoned_carts';
		$row   = $wpdb->get_row( $wpdb->prepare(
			"SELECT user_id, email, phone FROM {$table} WHERE id = %d LIMIT 1", $cart_id
		) );

		// Devolve o estoque reservado por este carrinho ANTES de apagar.
		if ( $row ) {
			self::release_for_cart( self::ident(
				(int) $row->user_id,
				(string) ( $row->email ?? '' ),
				(string) ( $row->phone ?? '' )
			) );
		}

		$deleted = $wpdb->delete( $table, [ 'id' => $cart_id ], [ '%d' ] );
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

		// Devolve TODO o estoque reservado por qualquer carrinho antes de zerar.
		global $wpdb;
		$holds = self::table();
		$rows  = $wpdb->get_results( "SELECT product_id, variation_id, qty FROM {$holds}", ARRAY_A );
		foreach ( (array) $rows as $r ) {
			self::credit_stock( (int) $r['product_id'], (int) $r['variation_id'], (int) $r['qty'] );
		}
		$wpdb->query( "TRUNCATE TABLE {$holds}" );

		$table  = $wpdb->prefix . 'wc_abandoned_carts';
		$result = $wpdb->query( "TRUNCATE TABLE {$table}" );
		if ( $result === false ) {
			wp_send_json_error( [ 'message' => 'Erro ao apagar os registros.' ] );
		}
		wp_send_json_success( [ 'message' => 'Todos os carrinhos apagados (estoque devolvido).' ] );
	}
}
