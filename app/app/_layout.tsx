import { usePathname } from 'one'
import { useEffect } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { AuthGate } from '~/components/workspace/AuthGate'
import { SkeletonLayout } from '~/components/workspace/SkeletonLayout'
import { useWorkspaceLayout } from '~/components/workspace/useWorkspaceLayout'
import { WorkspaceLayout } from '~/components/workspace/WorkspaceLayout'
import { WorkspaceLayoutProvider } from '~/components/workspace/WorkspaceLayoutProvider'
import { useAuth } from '~/lib/auth'

export default function OrgLayout() {
    return (
        <WorkspaceLayoutProvider>
            <OrgLayoutInner />
        </WorkspaceLayoutProvider>
    )
}

function OrgLayoutInner() {
    const auth = useAuth({ throwIfAnon: false })
    const isReady = !auth.isInitializing && auth.isLoggedIn

    return (
        <>
            <ActiveAddonSync />
            <WorkspaceLayout isReady={isReady} />
            {!isReady && (
                <View style={styles.overlay}>
                    <SkeletonLayout />
                    {!auth.isInitializing && !auth.isLoggedIn && <AuthGate />}
                </View>
            )}
        </>
    )
}

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10,
        ...(Platform.OS === 'web' ? { height: '100vh' as unknown as number } : {}),
    },
})

function ActiveAddonSync() {
    const pathname = usePathname()
    const { setActiveAddonSlug, setDrawerOpen } = useWorkspaceLayout()

    useEffect(() => {
        setDrawerOpen(false)

        const prefix = '/app/'
        if (!pathname.startsWith(prefix)) {
            setActiveAddonSlug(null)
            return
        }
        const rest = pathname.slice(prefix.length)
        const slug = rest.split('/')[0] || null
        setActiveAddonSlug(slug)
    }, [pathname, setActiveAddonSlug, setDrawerOpen])

    return null
}
