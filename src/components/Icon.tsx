import { 
  ClipboardList, 
  Target, 
  Ruler, 
  Utensils, 
  Dumbbell, 
  CheckSquare, 
  BarChart3,
  Menu
} from 'lucide-react'

interface IconProps {
  name: string
  className?: string
}

export default function Icon({ name, className = 'w-6 h-6' }: IconProps) {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    'clipboard-dumbbell': ClipboardList,
    'target': Target,
    'ruler': Ruler,
    'utensils': Utensils,
    'dumbbell': Dumbbell,
    'clipboard-check': CheckSquare,
    'chart-bar': BarChart3,
    'menu': Menu,
  }

  const IconComponent = icons[name] || ClipboardList

  return <IconComponent className={className} />
}

