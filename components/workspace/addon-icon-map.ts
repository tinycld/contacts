import {
    Building2,
    Calendar,
    HardDrive,
    Home,
    type LucideIcon,
    Mail,
    Settings,
    User,
    Users,
} from 'lucide-react-native'

const iconMap: Record<string, LucideIcon> = {
    users: Users,
    home: Home,
    mail: Mail,
    calendar: Calendar,
    settings: Settings,
    user: User,
    building: Building2,
    'hard-drive': HardDrive,
}

export function getIcon(name: string): LucideIcon {
    return iconMap[name] ?? Home
}
