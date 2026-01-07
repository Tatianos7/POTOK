import { useAuth } from '../context/AuthContext'
import Icon from './Icon'

export default function Header() {
  const { user } = useAuth()

  return (
    <header className="flex items-center justify-between px-2 sm:px-4 md:px-6 lg:px-8 py-4 bg-white border-b border-gray-100">
      <h1 className="text-lg font-semibold text-gray-900">
        Привет, {user?.name || 'Пользователь'}
      </h1>
      <button
        className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Меню"
      >
        <Icon name="menu" className="w-6 h-6" />
      </button>
    </header>
  )
}

