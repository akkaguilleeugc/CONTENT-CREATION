import { Compass } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/overlay';
import { Button } from '@/components/ui';

import { $t } from '@/lib/i18n';
export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="page">
      <div className="panel" style={{ marginTop: '8vh' }}>
        <EmptyState
          icon={<Compass />}
          title={$t("This page doesn’t exist")}
          text={$t("The link may be old or mistyped. Everything you need is one click away.")}
          actions={
            <>
              <Button variant="primary" onClick={() => navigate('/')}>{$t("Go to Overview")}</Button>
              <Button onClick={() => navigate(-1)}>{$t("Go back")}</Button>
            </>
          }
        />
      </div>
    </div>
  );
}
