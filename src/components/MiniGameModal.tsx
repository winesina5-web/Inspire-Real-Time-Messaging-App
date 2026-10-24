import React from 'react';
import { GameData } from '../types';

interface MiniGameModalProps {
  currentUserId: string;
  partnerId: string;
  onStartGame: (gameData: GameData) => void;
  onClose: () => void;
}

export const MiniGameModal: React.FC<MiniGameModalProps> = ({
  currentUserId,
  partnerId,
  onStartGame,
  onClose,
}) => {
  const handleStartTicTacToe = () => {
    const gameData: GameData = {
      game: 'tictactoe',
      board: Array(9).fill(null),
      currentPlayer: 'X',
      status: 'playing',
      turnUserId: currentUserId,
    };
    onStartGame(gameData);
  };

  const handleStartWordGuess = () => {
    const gameData: GameData = {
      game: 'wordguess',
      board: [],
      currentPlayer: 'P1',
      status: 'playing',
      turnUserId: currentUserId,
      targetWord: 'PEACH',
      guesses: [],
    };
    onStartGame(gameData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-sm bg-white dark:bg-[#161B2B] rounded-3xl p-6 border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl animate-slide-up">
        <div className="flex items-center space-x-2 mb-3">
          <span className="text-xl">🎮</span>
          <h3 className="font-extrabold text-base text-black dark:text-white">
            In-Chat Mini-Games
          </h3>
        </div>

        <p className="text-xs text-gray-500 mb-5">
          Play quick multiplayer games directly inside your chat conversation!
        </p>

        <div className="space-y-3 mb-6">
          <button
            type="button"
            onClick={handleStartTicTacToe}
            className="w-full p-4 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-[#0E2A6E] dark:hover:border-[#3D6FE0] text-left flex items-center space-x-3 transition-all hover:bg-gray-50 dark:hover:bg-gray-800/40"
          >
            <span className="text-3xl">❌⭕</span>
            <div>
              <div className="font-black text-sm text-black dark:text-white">Tic-Tac-Toe</div>
              <div className="text-xs text-gray-500">Classic 3x3 turn-based board challenge</div>
            </div>
          </button>

          <button
            type="button"
            onClick={handleStartWordGuess}
            className="w-full p-4 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-[#0E2A6E] dark:hover:border-[#3D6FE0] text-left flex items-center space-x-3 transition-all hover:bg-gray-50 dark:hover:bg-gray-800/40"
          >
            <span className="text-3xl">🔠</span>
            <div>
              <div className="font-black text-sm text-black dark:text-white">Word Guess</div>
              <div className="text-xs text-gray-500">Guess the 5-letter hidden word in 6 tries</div>
            </div>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
