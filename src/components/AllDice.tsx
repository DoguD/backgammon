import * as React from 'react';

import Dice from './Dice'

interface Props {
  movesLeft: number[]
}

const AllDice: React.FunctionComponent<Props> = ({ movesLeft }: Props) => {
  return (
    <g transform={`translate(${350 - 35 * movesLeft.length}, 220)`}>
      {movesLeft.map((m, i) =>
        <g key={i} transform={`translate(${70 * i}, 0)`}>
          <Dice number={m} />
        </g>
      )}
    </g>
  );
};

export default AllDice;
