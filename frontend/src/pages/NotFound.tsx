import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Compass, Home, Scale } from 'lucide-react';
import { Button } from '../components/UI';
import { useAuthStore } from '../stores/authStore';
import { roleHome } from '../utils/navigation';

/**
 * 404 page.
 *
 * Signed-in users are offered their role dashboard (so a stale bookmark never
 * dead-ends), visitors get the public landing page.
 */
export const NotFound: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const target = user ? roleHome(user.role) : '/';

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-4">
      <div className="auth-backdrop" aria-hidden="true" />

      <div className="relative z-10 w-full max-w-lg">
        <div className="glass-strong p-8 text-center animate-scale-in">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gold/10 flex items-center justify-center mb-5">
            <Scale size={26} className="text-gold" />
          </div>

          <p className="text-[11px] uppercase tracking-[0.2em] text-gold mb-2">Error 404</p>
          <h1 className="text-2xl font-bold text-white">This page is not on the docket</h1>
          <p className="text-sm text-text-secondary mt-2">
            The page you asked for has been moved, renamed or never existed. Check the address, or
            head back to familiar ground.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-7">
            <Button icon={Compass} onClick={() => navigate(target)}>
              {user ? 'Back to my dashboard' : 'Go to the home page'}
            </Button>
            <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(-1)}>
              Go back
            </Button>
          </div>

          <Link
            to={target}
            className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-gold transition-colors mt-5"
          >
            <Home size={12} />
            {target}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
