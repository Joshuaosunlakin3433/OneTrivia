module onetrivia::game {
    use one::clock::{Self, Clock};
    use one::event;
    use one::object::{Self, UID, ID};
    use one::table::{Self, Table};
    use one::transfer;
    use one::tx_context::TxContext;

    // ========== Error Codes ==========
    const EGameNotActive: u64 = 0;
    const EGameEnded: u64 = 1;
    const EInvalidAdmin: u64 = 2; // New Security Error

    // ========== Events ==========
    public struct GameCreated has copy, drop {
        game_id: ID,
        host: address,
        is_agent_game: bool,
    }

    public struct AnswerSubmitted has copy, drop {
        game_id: ID,
        player: address,
        score: u64,
        timestamp_ms: u64,
    }

    public struct GameEnded has copy, drop {
        game_id: ID,
        winner: address,
        top_score: u64,
    }

    // ========== Structs ==========
    public struct GameSession has key, store {
        id: UID,
        host: address,
        is_active: bool,
        scores: Table<address, u64>,
        top_score: u64,
        top_player: address,
    }

    public struct AdminCap has key, store {
        id: UID,
        game_id: ID,
    }

    // ========== Functions ==========

    // Changed 'public entry' to 'public' to fix Linter Warning W99010
    public fun create_game(is_agent: bool, ctx: &mut TxContext) {
        let game_uid = object::new(ctx);
        let game_id = object::uid_to_inner(&game_uid);
        let sender = ctx.sender();

        let game = GameSession {
            id: game_uid,
            host: sender,
            is_active: true,
            scores: table::new<address, u64>(ctx),
            top_score: 0,
            top_player: @0x0,
        };

        let admin_cap = AdminCap {
            id: object::new(ctx),
            game_id,
        };

        event::emit(GameCreated {
            game_id,
            host: sender,
            is_agent_game: is_agent,
        });

        transfer::share_object(game);
        transfer::transfer(admin_cap, sender);
    }

    public fun submit_answer(
        game: &mut GameSession,
        clock: &Clock,
        _answer_index: u64,
        ctx: &mut TxContext,
    ) {
        assert!(game.is_active, EGameNotActive);

        let player = ctx.sender();
        let points: u64 = 10;
        let timestamp_ms = clock::timestamp_ms(clock);
        let game_id = object::id(game);

        let new_score = if (table::contains(&game.scores, player)) {
            let current_score = table::borrow_mut(&mut game.scores, player);
            *current_score = *current_score + points;
            *current_score
        } else {
            table::add(&mut game.scores, player, points);
            points
        };

        if (new_score > game.top_score) {
            game.top_score = new_score;
            game.top_player = player;
        };

        event::emit(AnswerSubmitted {
            game_id,
            player,
            score: new_score,
            timestamp_ms,
        });
    }

    public fun end_game(
        game: &mut GameSession,
        cap: &AdminCap,
        _ctx: &mut TxContext, // Added underscore to fix Warning W09002
    ) {
        // SECURITY FIX: Ensure this AdminCap matches this Game
        assert!(cap.game_id == object::id(game), EInvalidAdmin);

        assert!(game.is_active, EGameEnded);
        game.is_active = false;

        event::emit(GameEnded {
            game_id: object::id(game),
            winner: game.top_player,
            top_score: game.top_score,
        });
    }
}

#[test_only]
module onetrivia::game_tests {
    use one::clock;
    use one::test_scenario::{Self as ts, Scenario};
    use one::transfer;
    use onetrivia::game::{Self, GameSession, AdminCap};

    #[test]
    fun test_e2e_game_loop() {
        let host: address = @0xA;
        let player: address = @0xB;

        let mut scenario_val: Scenario = ts::begin(host);
        let scenario = &mut scenario_val;

        // Transaction 1 (Host): create game.
        game::create_game(false, ts::ctx(scenario));

        // Transaction 2 (Player): submit answer with a test clock.
        ts::next_tx(scenario, player);
        let mut game_session = ts::take_shared<GameSession>(scenario);
        let test_clock = clock::create_for_testing(ts::ctx(scenario));
        game::submit_answer(&mut game_session, &test_clock, 0, ts::ctx(scenario));
        ts::return_shared(game_session);
        clock::destroy_for_testing(test_clock);

        // Transaction 3 (Host): end game using AdminCap owned by host.
        ts::next_tx(scenario, host);
        let mut game_session = ts::take_shared<GameSession>(scenario);
        let admin_cap = ts::take_from_sender<AdminCap>(scenario);
        game::end_game(&mut game_session, &admin_cap, ts::ctx(scenario));
        ts::return_shared(game_session);
        transfer::public_transfer(admin_cap, host);

        ts::end(scenario_val);
    }
}
