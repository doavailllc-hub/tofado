import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
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
import VendorCard from "../../components/VendorCard";

export default function RetailerVendorsHomeScreen({ navigation }) {
  const [vendors, setVendors] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);
      setError("");

      const [vendorResponse, requestResponse] = await Promise.all([
        api.get("/retailer/wholesalers"),
        api.get("/retailer/wholesaler-requests"),
      ]);

      const vendorPayload = vendorResponse.data;
      const requestPayload = requestResponse.data;

      setVendors(
        Array.isArray(vendorPayload)
          ? vendorPayload
          : Array.isArray(vendorPayload?.wholesalers)
            ? vendorPayload.wholesalers
            : []
      );

      setRequests(
        Array.isArray(requestPayload)
          ? requestPayload
          : Array.isArray(requestPayload?.requests)
            ? requestPayload.requests
            : []
      );
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          "Unable to load your wholesaler network."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pendingCount = requests.filter(
    (item) => String(item.status).toLowerCase() === "pending"
  ).length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.page}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.primary}
          />
        }
      >
        <MobileHeader
          eyebrow="Vendor network"
          title="Wholesalers"
          subtitle="Build your supplier network and order only from businesses that accepted your request."
          actionIcon="search-outline"
          onAction={() => navigation.navigate("FindWholesalers")}
        />

        <View style={styles.quickGrid}>
          <Pressable
            style={[styles.quick, styles.quickBlue]}
            onPress={() => navigation.navigate("FindWholesalers")}
          >
            <View style={styles.quickIcon}>
              <Ionicons name="search-outline" size={20} color={colors.primary} />
            </View>
            <Text style={styles.quickTitle}>Find wholesalers</Text>
            <Text style={styles.quickCopy}>Search verified suppliers</Text>
          </Pressable>

          <Pressable
            style={[styles.quick, styles.quickOrange]}
            onPress={() => navigation.navigate("VendorRequests")}
          >
            <View style={styles.quickIcon}>
              <Ionicons name="time-outline" size={20} color={colors.orange} />
            </View>
            <Text style={styles.quickTitle}>Requests</Text>
            <Text style={styles.quickCopy}>
              {pendingCount} pending request{pendingCount === 1 ? "" : "s"}
            </Text>
          </Pressable>
        </View>

        {!!error && (
          <Pressable style={styles.error} onPress={() => load()}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.red} />
            <Text style={styles.errorText}>{error}</Text>
          </Pressable>
        )}

        <View style={styles.sectionRow}>
          <View>
            <Text style={styles.sectionTitle}>Connected wholesalers</Text>
            <Text style={styles.sectionCopy}>
              {vendors.length} approved supplier{vendors.length === 1 ? "" : "s"}
            </Text>
          </View>

          {!!vendors.length && (
            <Pressable onPress={() => load(true)}>
              <Ionicons
                name="refresh-outline"
                size={20}
                color={colors.primary}
              />
            </Pressable>
          )}
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading suppliers…</Text>
          </View>
        ) : vendors.length ? (
          <View style={styles.list}>
            {vendors.map((vendor) => (
              <VendorCard
                key={vendor.id}
                vendor={{ ...vendor, connection_status: "active" }}
                actionLabel="Create purchase order"
                actionIcon="bag-add-outline"
                onPress={() =>
                  navigation.getParent()?.navigate("RetailerOrders", {
                    screen: "CreateOrder",
                    params: {
                      wholesalerId: vendor.id,
                      wholesalerName: vendor.business_name,
                    },
                  })
                }
              />
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="people-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No connected wholesalers yet</Text>
            <Text style={styles.emptyCopy}>
              Find a verified wholesaler and send a connection request.
            </Text>
            <Pressable
              style={styles.emptyButton}
              onPress={() => navigation.navigate("FindWholesalers")}
            >
              <Ionicons name="search-outline" size={16} color={colors.white} />
              <Text style={styles.emptyButtonText}>Find wholesalers</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  page: { padding: 20, paddingBottom: 34 },
  quickGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  quick: {
    width: "48.5%",
    minHeight: 130,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
  },
  quickBlue: { backgroundColor: colors.primarySoft },
  quickOrange: { backgroundColor: colors.orangeSoft },
  quickIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  quickTitle: {
    marginTop: 13,
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
  },
  quickCopy: {
    marginTop: 5,
    color: colors.body,
    fontSize: 9,
  },
  error: {
    marginTop: 15,
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.redSoft,
  },
  errorText: {
    flex: 1,
    color: colors.red,
    fontSize: 10,
    lineHeight: 15,
  },
  sectionRow: {
    marginTop: 24,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  sectionCopy: {
    marginTop: 4,
    color: colors.body,
    fontSize: 9,
  },
  loading: {
    minHeight: 230,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 8,
    color: colors.body,
    fontSize: 10,
  },
  list: { gap: 11 },
  empty: {
    minHeight: 270,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.white,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
  },
  emptyTitle: {
    marginTop: 14,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  emptyCopy: {
    marginTop: 6,
    maxWidth: 270,
    color: colors.body,
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
  },
  emptyButton: {
    minHeight: 42,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  emptyButtonText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "900",
  },
});
