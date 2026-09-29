import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import api from "../../services/api";
import { colors } from "../../theme/colors";
import MobileHeader from "../../components/MobileHeader";
import StatusBadge from "../../components/StatusBadge";

function VendorLogo() {
  return (
    <View style={styles.logo}>
      <Ionicons name="business-outline" size={21} color={colors.primary} />
    </View>
  );
}

export default function VendorRequestsScreen({ navigation }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const { data } = await api.get("/retailer/wholesaler-requests");

      setRequests(
        Array.isArray(data)
          ? data
          : Array.isArray(data?.requests)
            ? data.requests
            : []
      );
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          "Unable to load connection requests."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cancelRequest = async (item) => {
    try {
      setCancellingId(item.connection_id);
      setError("");
      setNotice("");

      const { data } = await api.delete(
        `/retailer/wholesaler-requests/${item.connection_id}`
      );

      setRequests((current) =>
        current.filter(
          (record) => record.connection_id !== item.connection_id
        )
      );

      setNotice(data?.message || "Connection request cancelled.");
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          "Unable to cancel connection request."
      );
    } finally {
      setCancellingId(null);
    }
  };

  const sorted = useMemo(() => {
    return [...requests].sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (b.status === "pending" && a.status !== "pending") return 1;
      return Number(b.connection_id || 0) - Number(a.connection_id || 0);
    });
  }, [requests]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.page}>
        <MobileHeader
          eyebrow="Vendor network"
          title="Connection requests"
          subtitle="Track pending, accepted, and rejected supplier requests."
          onBack={() => navigation.goBack()}
          actionIcon="add-outline"
          onAction={() => navigation.navigate("FindWholesalers")}
        />

        {!!error && (
          <View style={styles.error}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!!notice && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        )}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading requests…</Text>
          </View>
        ) : sorted.length ? (
          <View style={styles.list}>
            {sorted.map((item) => {
              const pending = String(item.status).toLowerCase() === "pending";
              const active = String(item.status).toLowerCase() === "active";

              return (
                <View style={styles.card} key={item.connection_id}>
                  <View style={styles.top}>
                    <VendorLogo />

                    <View style={styles.copy}>
                      <Text numberOfLines={1} style={styles.name}>
                        {item.business_name || "Wholesaler"}
                      </Text>
                      <Text numberOfLines={1} style={styles.location}>
                        {item.location || "Location not provided"}
                      </Text>
                    </View>

                    <StatusBadge status={item.status} />
                  </View>

                  <View style={styles.message}>
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={styles.messageText}>
                      {item.request_message ||
                        "Business connection request"}
                    </Text>
                  </View>

                  {pending && (
                    <Pressable
                      disabled={cancellingId === item.connection_id}
                      style={styles.cancel}
                      onPress={() => cancelRequest(item)}
                    >
                      <Ionicons
                        name="close-outline"
                        size={16}
                        color={colors.red}
                      />
                      <Text style={styles.cancelText}>
                        {cancellingId === item.connection_id
                          ? "Cancelling…"
                          : "Cancel request"}
                      </Text>
                    </Pressable>
                  )}

                  {active && (
                    <Pressable
                      style={styles.orderButton}
                      onPress={() =>
                        navigation.getParent()?.navigate("RetailerOrders", {
                          screen: "CreateOrder",
                          params: {
                            wholesalerId: item.wholesaler_id,
                            wholesalerName: item.business_name,
                          },
                        })
                      }
                    >
                      <Ionicons
                        name="bag-add-outline"
                        size={16}
                        color={colors.white}
                      />
                      <Text style={styles.orderButtonText}>
                        Create purchase order
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={30} color={colors.muted} />
            <Text style={styles.emptyTitle}>No connection requests</Text>
            <Text style={styles.emptyCopy}>
              Find a wholesaler and send your first request.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  page: { padding: 20, paddingBottom: 34 },
  error: {
    marginBottom: 12,
    padding: 11,
    borderRadius: 11,
    backgroundColor: colors.redSoft,
  },
  errorText: { color: colors.red, fontSize: 10 },
  notice: {
    marginBottom: 12,
    padding: 11,
    borderRadius: 11,
    backgroundColor: colors.greenSoft,
  },
  noticeText: { color: "#15803D", fontSize: 10 },
  loading: {
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 9,
    color: colors.body,
    fontSize: 10,
  },
  list: { gap: 11 },
  card: {
    padding: 15,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.white,
  },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  logo: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
  },
  copy: { flex: 1, minWidth: 0 },
  name: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
  },
  location: {
    marginTop: 4,
    color: colors.body,
    fontSize: 9,
  },
  message: {
    marginTop: 13,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 11,
    borderRadius: 11,
    backgroundColor: colors.soft,
  },
  messageText: {
    flex: 1,
    color: colors.body,
    fontSize: 9,
    lineHeight: 14,
  },
  cancel: {
    minHeight: 40,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 11,
    backgroundColor: colors.redSoft,
  },
  cancelText: {
    color: colors.red,
    fontSize: 9,
    fontWeight: "800",
  },
  orderButton: {
    minHeight: 40,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 11,
    backgroundColor: colors.primary,
  },
  orderButtonText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: "900",
  },
  empty: {
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 10,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  emptyCopy: {
    marginTop: 5,
    color: colors.body,
    fontSize: 10,
  },
});
