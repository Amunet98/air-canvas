import AirCanvas from './components/AirCanvas.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';

function App() {
  return (
    // min-h-dvh, not min-h-screen: 100vh sits under mobile browser chrome and
    // leaves the page scrollable by the height of the address bar.
    <div className="min-h-dvh bg-bg text-gray-900 dark:text-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 relative">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-4">
          <ThemeToggle />
        </div>
        <header className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold">Air Canvas</h1>
          {/* 16px floor on mobile: smaller body text triggers iOS auto-zoom
              on focus and reads poorly at arm's length. */}
          <p className="mt-3 text-base opacity-70 max-w-xl mx-auto">
            Draw in the air with your index finger. Raise two fingers to move
            without drawing. Everything runs in your browser &mdash; video
            never leaves your device.
          </p>
        </header>

        <AirCanvas />

        <footer className="text-center text-xs font-mono opacity-50 mt-12 pb-4">
          Built with MediaPipe hand landmarks &middot; 21 keypoints tracked
          per hand, all on-device
        </footer>
      </div>
    </div>
  );
}

export default App;
