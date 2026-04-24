import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { ethers } from "ethers";
import { WagmiProvider, useAccount, useDisconnect, useWalletClient } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, ConnectButton, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import api from "../utils/api";
import { useAuth } from "./AuthContext";
import "@rainbow-me/rainbowkit/styles.css";

// Define Hardhat local chain
const hardhatLocal = defineChain({
  id: 31337,
  name: "Hardhat Local",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
  testnet: true,
});

// Wagmi config
const wagmiConfig = getDefaultConfig({
  appName: "CrowdFund Platform",
  projectId: "00000000000000000000000000000000", // placeholder for local dev
  chains: [hardhatLocal],
  ssr: false,
});

const queryClient = new QueryClient();

// Inner context for ethers.js compatibility
const Web3Context = createContext(null);

export function useWeb3() {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error("useWeb3 must be used within Web3Provider");
  return ctx;
}

/**
 * Bridge between wagmi and ethers.js.
 * Provides: provider, signer, account, balance - compatible with existing components.
 */
function Web3Bridge({ children }) {
  const { user, refreshUser } = useAuth();
  const { address, isConnected, chain } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { disconnect } = useDisconnect();

  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [balance, setBalance] = useState("0");

  // Read-only provider (always available for reading blockchain data)
  useEffect(() => {
    const jsonProvider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    jsonProvider.getNetwork().then(() => {
      if (!isConnected) setProvider(jsonProvider);
    }).catch(() => {});
  }, [isConnected]);

  // When wallet connects, create ethers signer from walletClient
  useEffect(() => {
    if (walletClient && isConnected) {
      const ethersProvider = new ethers.BrowserProvider(walletClient.transport, {
        chainId: walletClient.chain.id,
        name: walletClient.chain.name,
      });
      setProvider(ethersProvider);
      ethersProvider.getSigner().then(setSigner).catch(() => setSigner(null));
    } else {
      setSigner(null);
    }
  }, [walletClient, isConnected]);

  // Fetch balance
  useEffect(() => {
    if (!provider || !address) { setBalance("0"); return; }
    const fetch = async () => {
      try {
        const bal = await provider.getBalance(address);
        setBalance(ethers.formatEther(bal));
      } catch { setBalance("0"); }
    };
    fetch();
    const interval = setInterval(fetch, 15000);
    return () => clearInterval(interval);
  }, [provider, address]);

  // Bind wallet: sign message to prove ownership, then save
  const bindWallet = useCallback(async () => {
    if (!isConnected || !address || !user || !signer) {
      throw new Error("Кошелёк не подключён");
    }
    const message = `CrowdFund: привязать кошелёк к аккаунту ${user.email}`;
    const signature = await signer.signMessage(message);
    const res = await api.put("/auth/wallet", { wallet_address: address, signature });
    await refreshUser();
    return res.data;
  }, [isConnected, address, user, signer, refreshUser]);

  // Unbind wallet: sign message to prove ownership, then remove
  const unbindWallet = useCallback(async () => {
    if (!user || !signer) {
      throw new Error("Кошелёк не подключён");
    }
    const message = `CrowdFund: отвязать кошелёк от аккаунта ${user.email}`;
    const signature = await signer.signMessage(message);
    await api.post("/auth/wallet/unbind", { signature });
    await refreshUser();
    disconnect();
  }, [user, signer, refreshUser, disconnect]);

  // Check if connected wallet matches bound wallet
  const isBound = !!(user?.wallet_address);
  const isWalletMatched = isBound && address && user.wallet_address.toLowerCase() === address.toLowerCase();
  const canTransact = isConnected && isWalletMatched;

  // Guarded signer: only returns signer if wallet matches bound address
  const guardedSigner = canTransact ? signer : null;

  const value = useMemo(() => ({
    provider,
    signer: guardedSigner,
    account: address || null,
    chainId: chain?.id || null,
    balance,
    connecting: false,
    isConnected,
    isBound,
    isWalletMatched,
    canTransact,
    bindWallet,
    unbindWallet,
  }), [provider, guardedSigner, address, chain, balance, isConnected, isBound, isWalletMatched, canTransact, bindWallet, unbindWallet]);

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
}

/**
 * Wrapper that sets up wagmi + RainbowKit + ethers bridge.
 */
export function Web3Provider({ children }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider locale="en" coolMode>
          <Web3Bridge>{children}</Web3Bridge>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

// Re-export ConnectButton for use in Navbar
export { ConnectButton };
