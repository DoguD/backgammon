import * as React from "react";
import styled from "styled-components";

import Board from "./Board";
import GameStatus from "./GameStatus";
import Button from "./Button";
import {
  getDiceNumber,
  getDiceNumbers,
  capturesOpponent,
  playerCanMove,
  getValidMoves
} from '../helpers/functions'
import {
  startingState,
  capturedTest,
  allInEndQuad,
  almostFinished,
  almostFinished2
} from '../helpers/testPiceArrays'
import {
  ME_HOME,
  OPPONENT_HOME,
  ME,
  NOT_STARTED,
  INITIAL_ROLLS,
  PLAY,
} from '../helpers/constants'
import Chat from "./Chat";
import Stats from "./Stats";

const Container = styled.div`
  display: grid;
  grid-gap: 10px;
  grid-template-columns: 750px 1fr;

  .board-container {
    width: 750px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    margin: auto;
  }

  .stats-container {
    grid-column: 1 / 3;
  }

  @media (max-width: 1000px) {
    grid-template-columns: 1fr;

    .stats-container {
      grid-column: 1 / 2;
    }
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
`

interface Move {
  piece: number,
  toSpike: number,
}

interface PropsI {}

interface StateI {
  gamePhase: number,
  myTurn: boolean,
  needsToRoll: boolean,
  initialDice: number,
  opponentInitialDice: number,
  dice: number[],
  movesLeft: number[],
  pieces: number[][],
  highlightedPiece: number[],
  highlightedSpikes: number[],
  highlightedHome0: boolean,
  highlightedHome1: boolean,
  message: string,
}

class Game extends React.Component<PropsI, StateI> {
  state = {
    gamePhase: NOT_STARTED,
    myTurn: true,
    needsToRoll: true,
    initialDice: -1,
    opponentInitialDice: -1,
    dice: [-1, -1],
    movesLeft: [-1],
    pieces: startingState,
    highlightedPiece: [-1, -1],
    highlightedSpikes: [],
    highlightedHome0: false,
    highlightedHome1: false,
    message: "",
  };

  /**
   * Starts a new game
   */
  startGame = () => {
    // TODO: Send a new-game or new-game message over socket
    this.setState({
      gamePhase: INITIAL_ROLLS,
    })
  }

  /**
   * Rolls the player's initial dice to decide who goes first
   */
  rollInitialDice = () => {
    // TODO: Send a roll-initial-dice message over socket
    const { opponentInitialDice } = this.state;
    if (opponentInitialDice === -1) {
      this.setState({
        initialDice: getDiceNumber(),
      });
    } else {
      const diceNum = getDiceNumber();
      const myTurn = diceNum > opponentInitialDice;
      const message1 = myTurn ? "You go first" : "Opponent goes first";
      const message2 = myTurn ? "Your turn!" : "Opponent's turn";
      this.setState({
        initialDice: diceNum,
        message: message1,
      });
      setTimeout(() => {
        this.setState({
          gamePhase: PLAY,
          myTurn,
          needsToRoll: false,
          initialDice: -1,
          opponentInitialDice: -1,
          dice: [diceNum, opponentInitialDice],
          movesLeft: [diceNum, opponentInitialDice],
          message: message2,
        });
      }, 2000);
    }
  }

  /**
   * Temporary function to roll the opponent's initial dice to decide who goes first
   */
  rollOpponentInitialDice = () => {
    // TODO: Delete this as it will be handled by the server and other client
    const { initialDice } = this.state;
    if (initialDice === -1) {
      this.setState({
        opponentInitialDice: getDiceNumber(),
      });
    } else {
      const opponentDiceNum = getDiceNumber();
      const myTurn = initialDice > opponentDiceNum;
      const message1 = myTurn ? "You go first" : "Opponent goes first";
      const message2 = myTurn ? "Your turn!" : "Opponent's turn";
      this.setState({
        opponentInitialDice: opponentDiceNum,
        message: message1,
      });
      setTimeout(() => {
        this.setState({
          gamePhase: PLAY,
          myTurn,
          needsToRoll: false,
          initialDice: -1,
          opponentInitialDice: -1,
          dice: [initialDice, opponentDiceNum],
          movesLeft: [initialDice, opponentDiceNum],
          message: message2,
        });
      }, 2000);
    }
  }

  /**
   * Handles click events on the pieces. It will either ignore the click,
   * or highlight the piece and spikes where the piece can move to.
   * @param player the player who clicked on the piece
   * @param pieceI which piece the player clicked
   */
  handlePieceClick = (player:number, pieceI:number) => {
    const { myTurn, needsToRoll, movesLeft, pieces } = this.state;
    const isMyChip = player === ME;
    if (myTurn && !needsToRoll && isMyChip) {
      // Highlight the spikes that the player can move to
      const validMoves:Move[] = getValidMoves(pieces, 0, movesLeft)
        .filter(m => m.piece === pieceI);
      const validSpikes:number[] = validMoves.map(m => m.toSpike);

      // Highlight the home if the player can move there
      let highlightedHome0;
      if (player === ME) {
        highlightedHome0 = validSpikes.filter(s => s >= ME_HOME).length > 0;
      } else {
        highlightedHome0 = validSpikes.filter(s => s <= OPPONENT_HOME).length > 0;
      }
      
      this.setState({
        highlightedPiece: [0, pieceI],
        highlightedSpikes: validSpikes,
        highlightedHome0,
      });
    }
  };

  /**
   * Handles spike clicks. This will move the highlighted piece to the clicked spike.
   * @param spikeNum The spike for the piece to move to
   */
  handleSpikeClick = (spikeNum: number) => {
    const { highlightedPiece } = this.state;
    this.movePiece(0, highlightedPiece[1], spikeNum);
  };

  /**
   * Moves a piece on the board
   * @param player The player who is moving
   * @param piece the piece to move
   * @param soSpike the spike to move to
   */
  movePiece = (player:number, piece:number, toSpike:number) => {
    const { pieces, movesLeft, myTurn } = this.state;
    const diceNumberUsed = player === ME ?
      toSpike - pieces[player][piece] :
      pieces[player][piece] - toSpike;
    const indexOfMove = movesLeft.indexOf(diceNumberUsed);
    // TODO: Make a call to the API to move the piece
    // TODO: The API will respond with the new board state

    // Move the piece
    let limitedToSpike = toSpike;
    if (toSpike < -1) limitedToSpike = -1;
    if (toSpike > 24) limitedToSpike = 24;
    pieces[player][piece] = limitedToSpike;

    // Check if a piece has been captured
    if (capturesOpponent(pieces, player, toSpike)) {
      const indexOfPiece = pieces[1 - player].indexOf(toSpike);
      pieces[1 - player][indexOfPiece] = player === ME ? ME_HOME : OPPONENT_HOME;
    }

    // Update moves left
    movesLeft.splice(indexOfMove, 1);

    if (movesLeft.length > 0) {
      // Current player has moves left
      this.setState({
        pieces,
        movesLeft,
        highlightedPiece: [-1, -1],
        highlightedSpikes: [],
        highlightedHome0: false,
        highlightedHome1: false,
      }, () => {
        if (myTurn) {
          this.checkPlayerCanMove();
        } else {
          this.opponentsMove();
        }
      });
    } else {
      // No more moves. Change turn
      if (myTurn) {
        this.setState({ pieces }, () => {
          setTimeout(() => {
            this.startOpponentsTurn();
          }, 2000);
        })
      } else {
        this.setState({ pieces }, () => {  
          setTimeout(() => {
            this.startPlayersTurn();
          }, 2000);
        })
      }
    }
  };

  /**
   * Gets random dice numbers
   */
  rollDice = () => {
    // TODO: Get the dice from the server via socket
    const { dice, movesLeft } = getDiceNumbers();
    this.setState({
      dice,
      movesLeft,
      needsToRoll: false
    }, () => {
      this.checkPlayerCanMove();
    });
  };

  /**
   * Temporary function to roll the dice for the opponent
   */
  opponentRollDice = () => {
    // TODO: Delete this as it will be handled by the server and other client
    const { dice, movesLeft } = getDiceNumbers();
    this.setState({
      dice,
      movesLeft,
      needsToRoll: false
    });
  }

  /**
   * Sets the state to start the opponent's turn
   */
  startOpponentsTurn = () => {
    this.setState({
      myTurn: false,
      needsToRoll: true,
      highlightedPiece: [-1, -1],
      highlightedSpikes: [],
      highlightedHome0: false,
      highlightedHome1: false,
      message: "Opponent's turn",
    });
  }

  /**
   * Makes an automated move. It gets all available moves an selects on at random
   */
  opponentsMove = () => {
    // TODO: Wait for websocket to send a message saying that the other player has moved.
    // TODO: The server will check whether the move is valid, and will send an updated
    // TODO: board state to the client.
    // TODO: Hand control back to the player.
    setTimeout(() => {
      const { pieces, movesLeft } = this.state;
      const validMoves = getValidMoves(pieces, 1, movesLeft);
      if (validMoves.length === 0) {
        this.setState({ message: "Opponent can't move." });
        setTimeout(() => {
          this.startPlayersTurn();
        }, 2000);
      } else {
        const randomI = Math.floor(Math.random() * validMoves.length);
        const chosenMove:Move = validMoves[randomI];
        this.movePiece(1, chosenMove.piece, chosenMove.toSpike);
      }
    }, 1000);
  }

  /**
   * Sets the state to start the player's turn
   */
  startPlayersTurn = () => {
    this.setState({
      myTurn: true,
      needsToRoll: true,
      dice: [-1, -1],
      movesLeft: [-1],
      highlightedPiece: [-1, -1],
      highlightedSpikes: [],
      highlightedHome0: false,
      highlightedHome1: false,
      message: "You move!",
    })
  }

  /**
   * Checks whether the player can move. If it can't, it gives control to the other player
   */
  checkPlayerCanMove = () => {
    const { pieces, movesLeft } = this.state;
    if (!playerCanMove(pieces, 0, movesLeft)) {
      this.setState({
        message: "No valid moves. Opponent's turn"
      }, () => {
        setTimeout(() => this.startOpponentsTurn(), 2000);
      });
    }
  }

  render() {
    const {
      gamePhase,
      pieces,
      initialDice,
      opponentInitialDice,
      movesLeft,
      myTurn,
      highlightedPiece,
      highlightedSpikes,
      highlightedHome0,
      highlightedHome1,
      needsToRoll,
      message,
    } = this.state;
    const rollDiceBtnDisabled = !myTurn || !needsToRoll;
    const computerRollBtnDisabled = myTurn || !needsToRoll;
    const computerMoveBtnDisabled = myTurn || needsToRoll;
    return (
      <Container>
        <div className="board-container">
          {gamePhase === NOT_STARTED ? (
            <Button handleClick={this.startGame} disabled={false} text="Start Game" />
          ) : (
            <>
              <Board
                gamePhase={gamePhase}
                pieces={pieces}
                handlePieceClick={this.handlePieceClick}
                handleSpikeClick={this.handleSpikeClick}
                highlightedPiece={highlightedPiece}
                highlightedSpikes={highlightedSpikes}
                initialDice={initialDice}
                opponentInitialDice={opponentInitialDice}
                movesLeft={movesLeft}
                highlightedHome0={highlightedHome0}
                highlightedHome1={highlightedHome1}
              />
              <GameStatus message={message} />
              {gamePhase === INITIAL_ROLLS ? (
                <ButtonContainer>
                  <Button handleClick={this.rollInitialDice} disabled={false} text="Roll Dice" />
                  <Button handleClick={this.rollOpponentInitialDice} disabled={false} text="Computer Roll Dice" />
                </ButtonContainer>
              ) : (
                <ButtonContainer>
                  <Button handleClick={this.rollDice} disabled={rollDiceBtnDisabled} text="Roll Dice" />
                  <Button handleClick={this.opponentRollDice} disabled={computerRollBtnDisabled} text="Trigger computer roll" />
                  <Button handleClick={this.opponentsMove} disabled={computerMoveBtnDisabled} text="Trigger computer move" />
                </ButtonContainer>
              )}
            </>
          )}
        </div>
        <div className="chat-container">
          <Chat />
        </div>
        <div className="stats-container">
          <Stats />
        </div>
      </Container>
    );
  }
}

export default Game;
