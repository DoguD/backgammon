import * as React from "react";
import * as io from 'socket.io-client';
import styled from "styled-components";

import Board from "./Board";
import GameStatus from "./GameStatus";
import Button from "./Button";
import {
    getDiceNumbers,
    playerCanMove,
    getValidMoves,
    gameIsOver,
} from '../helpers/functions'
import {startingState} from '../helpers/testPiceArrays'
import {
    ME_HOME,
    OPPONENT_HOME,
    ME,
    NOT_STARTED,
    INITIAL_ROLLS,
    PLAY,
    FINISHED,
} from '../helpers/constants'
import {ChatMessageI} from '../helpers/interfaces';
import Chat from "./Chat";

const BASE_URL = "http://0.0.0.0:8080/http://192.168.1.103";

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

  @media (max-width: 1000px) {
    grid-template-columns: 1fr;
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
`

interface MoveI {
    piece: number,
    toSpike: number,
}

interface GameStateMessageI {
    myTurn: boolean,
    needsToRoll: boolean,
    dice: number[],
    movesLeft: number[],
    pieces: number[][],
}

interface PropsI {
}

interface StateI {
    gamePhase: number,
    myTurn: boolean,
    needsToRoll: boolean,
    dice: number[],
    movesLeft: number[],
    pieces: number[][],
    highlightedPiece: number[],
    highlightedSpikes: number[],
    highlightedHome0: boolean,
    highlightedHome1: boolean,
    message: string,
    chatMessages: ChatMessageI[],
    myName: string,
    opponentName: string,
}

class Game extends React.Component<PropsI, StateI> {
    private socket: any;
    state = {
        gamePhase: PLAY,
        myTurn: true,
        needsToRoll: true,
        dice: [-1, -1],
        movesLeft: [-1, -1],
        pieces: startingState,
        highlightedPiece: [-1, -1],
        highlightedSpikes: [],
        highlightedHome0: false,
        highlightedHome1: false,
        message: "",
        chatMessages: [],
        myName: '',
        opponentName: '',
    };


    /**
     * Starts a new game
     */
    startInitialRollsPhase = () => {
        this.setState({
            gamePhase: INITIAL_ROLLS,
            message: "Roll the dice to see who goes first."
        })
    }

    /**
     * Rolls the player's initial dice to decide who goes first
     */
    rollInitialDice = () => {
        this.socket.emit('roll-initial-dice');
    }

    /**
     * Handles click events on the pieces. It will either ignore the click,
     * or highlight the piece and spikes where the piece can move to.
     * @param player the player who clicked on the piece
     * @param pieceI which piece the player clicked
     */
    handlePieceClick = (player: number, pieceI: number) => {
        const {myTurn, needsToRoll, movesLeft, pieces} = this.state;
        const isMyChip = player === ME;
        if (myTurn && !needsToRoll && isMyChip) {
            // Highlight the spikes that the player can move to
            const validMoves: MoveI[] = getValidMoves(pieces, 0, movesLeft)
                .filter(m => m.piece === pieceI);
            const validSpikes: number[] = validMoves.map(m => m.toSpike);

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
        const {highlightedPiece} = this.state;
        this.movePiece(highlightedPiece[1], spikeNum);
    };

    /**
     * Moves a piece on the board
     * @param piece the piece to move
     * @param soSpike the spike to move to
     */
    movePiece = (piece: number, toSpike: number) => {
        console.log(piece, toSpike);
        fetch(BASE_URL + "/BackGammonBeta/UIService/MoveButton.php", {
            method: 'POST',
            headers: {
                "Origin": "*",
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                'GameId': 'Some value',
                'another_param': 'Another value'
            })
        }).then(response => response.text())
            .then(data => {
                console.log("SERVER")
                console.log(data)
                let parsedData = (JSON.parse(data));
                console.log(typeof parsedData);
                console.log(parsedData.BoardInfo);
                console.log(parsedData.BoardInfo.BoardPosition);
                let serverPiecesTmp = parsedData.BoardInfo.BoardPosition.split(',');
                let serverPieces = []
                for (let i = 0; i < serverPiecesTmp.length; i++) {
                    serverPieces.push(parseInt(serverPiecesTmp[i]));
                }
                console.log("UI")
                console.log(this.state.pieces);

                let whites = [];
                let blacks = [];

                for (let i = 0; i < serverPieces.length; i++) {
                    if (serverPieces[i] > 0) {
                        for (let j = 0; j < serverPieces[i]; j++) {
                            whites.push(i);
                        }
                    }
                    if (serverPieces[i] < 0) {
                        for (let j = 0; j < -serverPieces[i]; j++) {
                            blacks.push(i);
                        }
                    }
                }
                this.setState({
                    pieces: [whites, blacks]
                })
            });
    }

    /** Get Board Info
     *
     */
    getBoardInfo = (gameID: number) => {
        fetch(BASE_URL + "/BackGammonBeta/UIService/GetBoard.php?GameID=" + gameID, {
            method: 'GET',
            headers: {
                "Origin": "*"
            }
        }).then(response => response.text())
            .then(data => {
                console.log("SERVER")
                console.log(data)
                let parsedData = (JSON.parse(data));
                console.log(typeof parsedData);
                console.log(parsedData.BoardInfo);
                console.log(parsedData.BoardInfo.BoardPosition);
                let serverPiecesTmp = parsedData.BoardInfo.BoardPosition.split(',');
                let serverPieces = []
                for (let i = 0; i < serverPiecesTmp.length; i++) {
                    serverPieces.push(parseInt(serverPiecesTmp[i]));
                }
                console.log("UI")
                console.log(this.state.pieces);

                let whites = [];
                let blacks = [];

                for (let i = 0; i < serverPieces.length; i++) {
                    if (serverPieces[i] > 0) {
                        for (let j = 0; j < serverPieces[i]; j++) {
                            whites.push(i);
                        }
                    }
                    if (serverPieces[i] < 0) {
                        for (let j = 0; j < -serverPieces[i]; j++) {
                            blacks.push(i);
                        }
                    }
                }
                this.setState({
                    pieces: [whites, blacks]
                })
            });
    }

    /**
     * Gets random dice numbers
     */
    rollDice = () => {
        fetch(BASE_URL + "/BackGammonBeta/UIService/RollDice.php", {
            method: 'GET',
            headers: {
                "Origin": "*"
            }
        }).then(response => response.text())
            .then(data => {
                console.log("Dice:", data)
                let tmpDice = data.split(",");
                let parsedDice = [];
                for (let i = 0; i < tmpDice.length; i++) {
                    parsedDice.push(parseInt(tmpDice[i]))
                }
                this.setState({
                    needsToRoll: false,
                    dice: parsedDice,
                    movesLeft: parsedDice
                })
            });
    }

    /**
     * Temporary function to roll the dice for the opponent
     */
    opponentRollDice = () => {
        // TODO: Delete this as it will be handled by the server and other client
        const {dice, movesLeft} = getDiceNumbers();
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
            message: "Your move",
        })
    }

    /**
     * Checks whether the player can move. If it can't, it gives control to the other player
     */
    checkPlayerCanMove = () => {
        const {pieces, movesLeft} = this.state;
        if (!playerCanMove(pieces, 0, movesLeft)) {
            this.setState({
                message: "No valid moves. Opponent's turn"
            }, () => {
                setTimeout(() => this.startOpponentsTurn(), 2000);
            });
        }
    }

    startNewGame = () => {
        this.socket.emit('play-again');

    }

    componentDidMount() {
        console.log("New game started");
        this.getBoardInfo(1);
        this.socket = io.connect('/');
        const pathname = window.location.pathname;
        const code = pathname.substring(1);
        this.socket.emit('join-game', code);

        this.socket.on('join-code', (code: string) => {
            const http = window.location.host === 'localhost:3000' ? 'http' : 'https';
            const url = `${http}://${window.location.host}/${code}`;
            const message = `Send your friend to the URL: ${url}`;
            this.setState({message});
        });

        this.socket.on('error-message', (error: string) => {
            this.setState({
                message: error,
            })
        });

        this.socket.on('chat', (message: string) => {
            const {chatMessages}: { chatMessages: ChatMessageI[] } = this.state;
            const chatMessage: ChatMessageI = {
                me: false,
                date: new Date().getTime(),
                message,
            }
            chatMessages.push(chatMessage)
            this.setState({chatMessages});
        });

        this.socket.on('opponent-name', (name: string) => {
            this.setState({opponentName: name});
        });

        this.socket.on('start-game', () => {
            this.startInitialRollsPhase();
        });

        this.socket.on('initial-dice', (dice: number) => {
            this.setState({
                movesLeft: [dice, -1],
            });
        });

        this.socket.on('opponent-initial-dice', (dice: number) => {
            this.setState({
                movesLeft: [-1, dice],
            });
        });

        this.socket.on('game-state', (gameState: GameStateMessageI) => {
            const finished = gameIsOver(gameState.pieces);
            this.setState({
                ...gameState,
                gamePhase: finished ? FINISHED : PLAY,
                highlightedPiece: [-1, -1],
                highlightedSpikes: [],
                highlightedHome0: false,
                highlightedHome1: false,
            })
        });

        this.socket.on('play-again', () => {
            this.setState({
                gamePhase: INITIAL_ROLLS,
                message: "Roll the dice to see who goes first.",
                pieces: startingState,
            });
        });
    }

    render() {
        const {
            gamePhase,
            pieces,
            movesLeft,
            myTurn,
            highlightedPiece,
            highlightedSpikes,
            highlightedHome0,
            highlightedHome1,
            needsToRoll,
            message,
            chatMessages,
            myName,
            opponentName,
        } = this.state;
        const rollDiceBtnDisabled = !myTurn || !needsToRoll;
        const needsToSetName = myName === '';
        const opponentNeedsToSetName = opponentName === '';
        return (
            <Container>
                <div className="board-container">
                    <Board
                        pieces={pieces}
                        handlePieceClick={this.handlePieceClick}
                        handleSpikeClick={this.handleSpikeClick}
                        highlightedPiece={highlightedPiece}
                        highlightedSpikes={highlightedSpikes}
                        movesLeft={movesLeft}
                        highlightedHome0={highlightedHome0}
                        highlightedHome1={highlightedHome1}
                    />
                    <GameStatus message={message}/>
                    <ButtonContainer>
                        {gamePhase === NOT_STARTED && null}
                        {gamePhase === INITIAL_ROLLS && (
                            <Button handleClick={this.rollInitialDice} disabled={false} text="Roll Dice"/>
                        )}
                        {gamePhase === PLAY && (
                            <Button handleClick={this.rollDice} disabled={rollDiceBtnDisabled} text="Roll Dice"/>
                        )}
                        {gamePhase === FINISHED && (
                            <Button handleClick={this.startNewGame} disabled={false} text="Start New Game"/>
                        )}
                    </ButtonContainer>
                </div>
            </Container>
        );
    }
}

export default Game;
