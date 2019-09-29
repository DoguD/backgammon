import * as express from 'express';
import * as http from 'http';
import * as path from 'path';
import * as socketIo from 'socket.io';

import {
  getDiceNumber,
  getDiceNumbers,
  capturesOpponent,
  playerCanMove,
  getValidMoves,
  getUniqueCode,
  moveIsValid,
  convertToPlayer1Pieces,
  convertToPlayer1Move,
} from './helpers/functions';
import { startingState, startingPieces } from './helpers/boardStates';
import { GameStateI, MoveI, GameStateMessageI, GameI } from './helpers/interfaces';
import {
  PLAYER_0_HOME,
  PLAYER_1_HOME,
  WAITING_FOR_OPPONENT,
  INITIAL_ROLLS,
  PLAY,
} from './helpers/constants';

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const gamesBeingPlayed:GameI[] = [];

const getGameIndex = (id: string) => (
  gamesBeingPlayed.findIndex(g => (
    g.player0Id === id || g.player1Id === id
  ))
);

const getGame = (id: string):GameI => {
  const index = getGameIndex(id);
  if (index < 0) {
    throw new Error("Game not found");
  }
  return gamesBeingPlayed[index];
}

const updateGame = (id: string, newState: GameI) => {
  const index = getGameIndex(id);
  gamesBeingPlayed[index] = newState;
}

const gameStateToMessage = (game: GameI, player: number):GameStateMessageI => {
  const { pieces } = game.gameState;
  return player === 0 ? {
    myTurn: game.gameState.player0Turn,
    needsToRoll: game.gameState.needsToRoll,
    dice: game.gameState.dice,
    movesLeft: game.gameState.movesLeft,
    pieces: pieces,
  } : {
    myTurn: !game.gameState.player0Turn,
    needsToRoll: game.gameState.needsToRoll,
    dice: game.gameState.dice,
    movesLeft: game.gameState.movesLeft,
    pieces: convertToPlayer1Pieces(game.gameState.pieces),
  }
}

app.use(express.static(path.resolve(__dirname, '../client')));

app.get('/*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../client', 'index.html'));
});

io.on('connection', (socket) => {
  socket.on('disconnect', function(){
    console.log('SOCKET: disconnect');
    console.log(`Number of games being played = ${gamesBeingPlayed.length}`);
    // TODO: Delete game if the host disconnects
  });

  socket.on('new-game', () => {
    console.log(`ID = ${socket.id}`);
    console.log('SOCKET: new game');
    const code = getUniqueCode();
    console.log('SOCKET emit: unique-code');
    socket.emit('unique-code', code);

    // Initial dice rolls are pre-determined
    const initialDice0 = getDiceNumber();
    let initialDice1 = getDiceNumber();
    // Keep rolling until the two dice are different
    while(initialDice0 === initialDice1) {
      initialDice1 = getDiceNumber();
    }

    // Construct the initial game state
    const gameState: GameStateI = {
      ...startingState,
      initialDice0,
      initialDice1,
      player0Turn: initialDice0 > initialDice1,
      dice: [initialDice0, initialDice1],
      movesLeft: [initialDice0, initialDice1],
    }

    // Deep copy of the pieces array
    gameState.pieces = [Array.from(startingPieces[0]), Array.from(startingPieces[1])];

    // Add the game state to volatile storage
    gamesBeingPlayed.push({
      player0Id: socket.id,
      player1Id: '',
      uniqueCode: code,
      gameState,
    });
    console.log(`Number of games being played = ${gamesBeingPlayed.length}`);
  });

  socket.on('join-game', (code) => {
    console.log(`ID = ${socket.id}`);
    console.log('SOCKET: join-game');
    const index = gamesBeingPlayed.findIndex(g => g.uniqueCode === code);
    if (index === -1 || gamesBeingPlayed[index].gameState.gamePhase !== WAITING_FOR_OPPONENT) {
      console.log('SOCKET emit: error-message');
      socket.emit('error-message', 'Unable to join a game with that code');
    } else {
      gamesBeingPlayed[index].player1Id = socket.id;
      gamesBeingPlayed[index].gameState.gamePhase = INITIAL_ROLLS;
      console.log('SOCKET emit: start-game');
      socket.emit('start-game');
      console.log('SOCKET emit: start-game');
      io.to(gamesBeingPlayed[index].player0Id).emit('start-game');
    }
  });

  socket.on('roll-initial-dice', () => {
    console.log('SOCKET: roll-initial-dice');
    try {
      const game = getGame(socket.id);
      if (game.gameState.gamePhase === INITIAL_ROLLS) {
        let initialDice: number;
        let opponentInitialDice: number;
        let opponentId: string;
        const player = game.player0Id === socket.id ? 0 : 1;
        if (player === 0) {
          initialDice = game.gameState.initialDice0;
          opponentInitialDice = game.gameState.initialDice1;
          // Reset the dice so they can't roll again
          game.gameState.initialDice0 = -1;
          opponentId = game.player1Id;
        } else {
          initialDice = game.gameState.initialDice1;
          opponentInitialDice = game.gameState.initialDice0;
          // Reset the dice so they can't roll again
          game.gameState.initialDice1 = -1;
          opponentId = game.player0Id;
        }

        if (initialDice < 0) {
          console.log('SOCKET emit: error-message');
          socket.emit('error-message', 'You have already rolled');
        } else {
          updateGame(socket.id, game);
          if (opponentInitialDice < 0) {
            // Both players have rolled, so start the game
            game.gameState.gamePhase = PLAY;
            console.log('SOCKET emit: game-state');
            socket.emit('game-state', gameStateToMessage(game, player));
            const opponentId = player === 0 ? game.player1Id : game.player0Id;
            console.log('SOCKET emit: game-state (other player)');
            io.to(opponentId).emit('game-state', gameStateToMessage(game, 1 - player));
          } else {
            // Waiting for other player to roll
            console.log('SOCKET emit: initial-dice');
            socket.emit('initial-dice', initialDice);
            console.log('SOCKET emit: opponent-initial-dice');
            io.to(opponentId).emit('opponent-initial-dice', initialDice);
          }        
        }
      }
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('move-piece', (m: MoveI) => {
    console.log('SOCKET: move-piece');
    try {
      const game = getGame(socket.id);
      const player = game.player0Id === socket.id ? 0 : 1;
      const turn = game.gameState.player0Turn ? 0 : 1;
      if (player !== turn) {
        // Player tried to play out of turn
        console.log('SOCKET emit: error-message');
        socket.emit('error-message', 'Not your turn');
      } else {
        const move = player === 0 ? m : convertToPlayer1Move(m);
        if (!moveIsValid(game.gameState.pieces, player, move)) {
          console.log('SOCKET emit: error-message');
          socket.emit('error-message', 'Move is not valid');
        } else {
          let diceNumberUsed: number;
          if (player === 0) {
            diceNumberUsed = move.toSpike - game.gameState.pieces[player][move.piece]
          } else {
            diceNumberUsed = game.gameState.pieces[player][move.piece] - move.toSpike;
          }
          
          let indexOfMove = game.gameState.movesLeft.indexOf(diceNumberUsed);
          // indexOfMove will be -1 if the number used is larger than the required
          // mode. This will occur when moving pieces home at the end of the game.
          let i = 1;
          while (indexOfMove === -1) {
            indexOfMove = game.gameState.movesLeft.indexOf(diceNumberUsed + i);
            i++;
          }
          // Move the piece
          let limitedToSpike = move.toSpike;
          if (move.toSpike < -1) limitedToSpike = -1;
          if (move.toSpike > 24) limitedToSpike = 24;
          if (limitedToSpike !== move.toSpike) {
            console.log("WOW! Limited toSpoke !== toSpike");
            console.log(`limitedToSpike: ${limitedToSpike}`);
            console.log(`move.toSpike: ${move.toSpike}`);
          }
          game.gameState.pieces[player][move.piece] = limitedToSpike;

          // Check if a piece has been captured
          if (capturesOpponent(game.gameState.pieces, player, move.toSpike)) {
            const indexOfPiece = game.gameState.pieces[1 - player].indexOf(move.toSpike);
            game.gameState.pieces[1 - player][indexOfPiece] = player === 0 ? PLAYER_0_HOME : PLAYER_1_HOME;
          }

          // Update moves left
          let movesLeft = game.gameState.movesLeft;
          movesLeft.splice(indexOfMove, 1);
          game.gameState.movesLeft = movesLeft;

          // If the turn is over, change the game state
          if (movesLeft.length === 0) {
            game.gameState.dice = [-1, -1];
            game.gameState.movesLeft = [-1, -1];
            game.gameState.needsToRoll = true;
            game.gameState.player0Turn = player === 0 ? false : true;
          }

          // Update the server state
          updateGame(socket.id, game);

          console.log(`SOCKET emit: game-state`);
          socket.emit('game-state', gameStateToMessage(game, player));
          const opponentId = player === 0 ? game.player1Id : game.player0Id;
          console.log('SOCKET emit: game-state (other player)');
          io.to(opponentId).emit('game-state', gameStateToMessage(game, 1 - player));
        }
      }
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('roll-dice', () => {
    console.log('SOCKET: roll-dice');
    const game = getGame(socket.id);
    const player = socket.id === game.player0Id ? 0 : 1;
    const playersTurn = player === 0 ? game.gameState.player0Turn : !game.gameState.player0Turn;
    if (game.gameState.gamePhase !== PLAY || !playersTurn || !game.gameState.needsToRoll) {
      console.log('SOCKET emit: error-message');
      socket.emit('error-message', 'You can\'t roll right now');
    } else {
      const diceNumbers = getDiceNumbers();
      game.gameState.dice = diceNumbers.dice;
      game.gameState.movesLeft = diceNumbers.movesLeft;
      game.gameState.needsToRoll = false;
      updateGame(socket.id, game);

      // Send dice to client
      console.log('SOCKET emit: game-state');
      socket.emit('game-state', gameStateToMessage(game, player));
      const opponentId = player === 0 ? game.player1Id : game.player0Id;
      console.log('SOCKET emit: game-state (other player)');
      io.to(opponentId).emit('game-state', gameStateToMessage(game, 1 - player));
    }
  });

  socket.on('play-again', () => {
    console.log('SOCKET: play-again');
  });

  socket.on('chat', (message: string) => {
    console.log(message);
  });
});

const port = process.env.PORT || 3000;
server.listen(3000, function(){
  console.log(`listening at http://localhost:${port}`);
});