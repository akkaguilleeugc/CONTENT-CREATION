import { Compass } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/overlay';
import { Button } from '@/components/ui';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="page">
      <div className="panel" style={{ marginTop: '8vh' }}>
        <EmptyState
          icon={<Compass />}
          title="This page doesn’t exist"
          text="The link may be old or mistyped. Everything you need is one click away."
          actions={
            <>
              <Button variant="primary" onClick={() => navigate('/')}>Go to Overview</Button>
              <Button onClick={() => navigate(-1)}>Go back</Button>
            </>
          }
        />
      </div>
    </div>
  );
}
