import { redirect } from 'next/navigation';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
    if (typeof window !== 'undefined') {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        
        if (!user || !user.token) {
            redirect('/login');
        }
    }

    return <>{children}</>;
}