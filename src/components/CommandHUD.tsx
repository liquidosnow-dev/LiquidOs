/**
 * CommandHUD — Live ledger telemetry for LiquidOS ONE Sovereign Substrate.
 * Displays real audit head from an-nexus. Never fabricates cryptographic material.
 */

import React, { useState, useEffect } from 'react';
import { nexusBridge } from '../services/nexusBridge';

export const CommandHUD: React.FC<{ activeSessionId: string }> = ({
  activeSessionId,
}) => {
  const [ledgerHead, setLedgerHead] = useState<string>('');
  const [gatewayStatus, setGatewayStatus] = useState<'ONLINE' | 'OFFLINE'>(
    'OFFLINE'
  );

  useEffect(() => {
    let isMounted = true;

    const fetchLedgerHead = async () => {
      try {
        const head = await nexusBridge.getAuditHead();
        if (isMounted) {
          setLedgerHead(head.substring(0, 8));
          setGatewayStatus('ONLINE');
        }
      } catch {
        if (isMounted) {
          setGatewayStatus('OFFLINE');
          setLedgerHead('');
        }
      }
    };

    fetchLedgerHead();
    const interval = setInterval(fetchLedgerHead, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-[#090A0F]/90 backdrop-blur-md border-b border-[#00F0FF]/20 text-[#00F0FF] font-mono text-xs">
      <div className="flex items-center space-x-3">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            gatewayStatus === 'ONLINE'
              ? 'bg-[#00F0FF] animate-pulse'
              : 'bg-[#FF3333]'
          }`}
        />
        <span className="tracking-widest uppercase font-semibold">
          LiquidOS ONE // Sovereign Substrate
        </span>
      </div>
      <div className="flex items-center space-x-4 text-[#FFD700]">
        <span>SESSION: {activeSessionId}</span>
        <span
          className={
            gatewayStatus === 'ONLINE' ? 'text-[#00F0FF]' : 'text-[#FF3333]'
          }
        >
          {gatewayStatus === 'ONLINE'
            ? '● GATEWAY ACTIVE'
            : '○ GATEWAY OFFLINE'}
        </span>
        <span className="text-[#00F0FF] opacity-70">
          LEDGER: {ledgerHead ? `0x${ledgerHead}` : '---'}
        </span>
      </div>
    </div>
  );
};
