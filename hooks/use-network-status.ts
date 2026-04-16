import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

/**
 * Hook to monitor network connectivity.
 * Returns whether the device is currently online and a sync message.
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? true);
    });

    return () => unsubscribe();
  }, []);

  return { isOnline };
}
