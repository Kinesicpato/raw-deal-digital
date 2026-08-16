import { useAppStore } from './store/useAppStore'
import { MenuPage } from './pages/MenuPage'
import { SetupPage } from './pages/SetupPage'
import { DeckbuilderPage } from './pages/DeckbuilderPage'
import { GamePage } from './pages/GamePage'
import { LobbyPage } from './pages/LobbyPage'

export default function App() {
  const view = useAppStore((s) => s.view)

  switch (view) {
    case 'setup':
      return <SetupPage />
    case 'deck':
      return <DeckbuilderPage />
    case 'game':
      return <GamePage />
    case 'lobby':
      return <LobbyPage />
    default:
      return <MenuPage />
  }
}
