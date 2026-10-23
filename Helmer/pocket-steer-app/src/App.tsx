/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HelmerProvider, useHelmer } from './lib/useHelmer';
import { AmbientBackground } from './components/AmbientBackground';
import { MobileFrame } from './components/MobileFrame';
import { TabBar } from './components/TabBar';
import { PocketRemoteScreen } from './components/screens/PocketRemoteScreen';
import { ConsoleScreen } from './components/screens/ConsoleScreen';
import { TelemetryScreen } from './components/screens/TelemetryScreen';
import { VerifyScreen } from './components/screens/VerifyScreen';
import { VaultScreen } from './components/screens/VaultScreen';
import { DeliverableModal } from './components/modals/DeliverableModal';
import { RedirectModal } from './components/modals/RedirectModal';
import { EstopModal } from './components/modals/EstopModal';
import { QrModal } from './components/modals/QrModal';

const AppContent: React.FC = () => {
  const { activeTab } = useHelmer();

  return (
    <>
      <AmbientBackground />
      <MobileFrame>
        {activeTab === 'steer' && <PocketRemoteScreen />}
        {activeTab === 'console' && <ConsoleScreen />}
        {activeTab === 'telemetry' && <TelemetryScreen />}
        {activeTab === 'verify' && <VerifyScreen />}
        {activeTab === 'vault' && <VaultScreen />}
        <TabBar />
      </MobileFrame>

      {/* Global VisionOS Modals */}
      <DeliverableModal />
      <RedirectModal />
      <EstopModal />
      <QrModal />
    </>
  );
};

export default function App() {
  return (
    <HelmerProvider>
      <AppContent />
    </HelmerProvider>
  );
}
