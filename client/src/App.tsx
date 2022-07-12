import * as React from 'react';

import Game from './components/Game';
import StartScreen from './components/StartScreen';
import Analytics from './components/Analytics';

const App = () => {
    return (
        <div style={{display: "flex", alignItems: "center", justifyContent: "center"}}>
            <Game/>
        </div>
    );
};

export default App;
