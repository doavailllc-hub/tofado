import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { colors, shadow } from "../../theme/colors";
import { friendlyError } from "../../utils/errors";
import StatusBadge from "../../components/StatusBadge";
import ErrorState from "../../components/ErrorState";
import { DashboardSkeleton } from "../../components/Skeleton";
import { money } from "../../utils/format";

const metricConfig = {
  retailer: [
    {
      label: "Total orders",
      key: "total_orders",
      icon: "bag-handle-outline",
      color: "#1A73E8",
      soft: "#E8F0FE",
    },
    {
      label: "Pending",
      key: "pending_orders",
      icon: "time-outline",
      color: "#B06000",
      soft: "#FEF7E0",
    },
    {
      label: "Purchase value",
      key: "purchase_value",
      icon: "wallet-outline",
      color: "#1A73E8",
      soft: "#E8F0FE",
      isMoney: true,
    },
    {
      label: "Outstanding",
      key: "outstanding",
      icon: "receipt-outline",
      color: "#137333",
      soft: "#E6F4EA",
      isMoney: true,
    },
  ],
  wholesaler: [
    {
      label: "Total orders",
      key: "total_orders",
      icon: "bag-handle-outline",
      color: "#1A73E8",
      soft: "#E8F0FE",
    },
    {
      label: "Pending",
      key: "pending_orders",
      icon: "time-outline",
      color: "#B06000",
      soft: "#FEF7E0",
    },
    {
      label: "Delivered",
      key: "delivered_orders",
      icon: "checkmark-circle-outline",
      color: "#137333",
      soft: "#E6F4EA",
    },
    {
      label: "Retailers",
      key: "retailers",
      icon: "people-outline",
      color: "#1A73E8",
      soft: "#E8F0FE",
    },
  ],
};

export default function DashboardScreen({ role }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [alerts, setAlerts] = useState({ requests: 0, notifications: 0 });

  const load = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) setRefreshing(true);
        else setLoading(true);
        setError("");

        const result = await api.get(`/${role}/dashboard`);
        setData(result.data || {});
      } catch (requestError) {
        setError(
          friendlyError(requestError, "We couldn't load your dashboard.")
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [role]
  );

  useEffect(() => {
    load();
  }, [load]);

  const loadAlerts = useCallback(async () => {
    if (role === "retailer") {
      const results = await Promise.allSettled([
        api.get("/retailer/orders"),
        api.get("/retailer/invoices"),
        api.get("/retailer/wholesaler-requests"),
      ]);
      const payload = (result, key) => result.status === "fulfilled" ? (Array.isArray(result.value.data) ? result.value.data : result.value.data?.[key] || []) : [];
      const orders = payload(results[0], "orders");
      const invoices = payload(results[1], "invoices");
      const requests = payload(results[2], "requests");
      const activeOrders = orders.filter((item) => !["delivered", "cancelled"].includes(String(item.status || "").toLowerCase())).length;
      const dueInvoices = invoices.filter((item) => !["paid", "cancelled"].includes(String(item.status || "").toLowerCase())).length;
      const pendingRequests = requests.filter((item) => String(item.status || "").toLowerCase() === "pending").length;
      setAlerts({ requests: 0, notifications: activeOrders + dueInvoices + pendingRequests });
      return;
    }
    const results = await Promise.allSettled([
      api.get("/wholesaler/retailer-requests"),
      api.get("/wholesaler/orders"),
      api.get("/wholesaler/payments"),
    ]);
    const payload = (result, key) => result.status === "fulfilled" ? (Array.isArray(result.value.data) ? result.value.data : result.value.data?.[key] || []) : [];
    const requests = payload(results[0], "requests");
    const orders = payload(results[1], "orders");
    const payments = payload(results[2], "payments");
    const pendingOrders = orders.filter((item) => ["pending", "confirmed"].includes(String(item.status || "").toLowerCase())).length;
    const pendingPayments = payments.filter((item) => String(item.status || "").toLowerCase() === "pending").length;
    setAlerts({ requests: requests.length, notifications: requests.length + pendingOrders + pendingPayments });
  }, [role]);

  useFocusEffect(useCallback(() => {
    loadAlerts();
    const timer = setInterval(loadAlerts, 30000);
    return () => clearInterval(timer);
  }, [loadAlerts]));

  const stats = data?.stats || {};
  const recent = Array.isArray(data?.recent)
    ? data.recent
    : Array.isArray(data?.recent_orders)
    ? data.recent_orders
    : [];

  const actions = useMemo(() => {
    if (role === "retailer") {
      return [
        {
          label: "New order",
          caption: "Create purchase",
          icon: "add-outline",
          color: "#1A73E8",
          soft: "#E8F0FE",
          onPress: () =>
            navigation.navigate("RetailerOrders", { screen: "CreateOrder" }),
        },
        {
          label: "Vendors",
          caption: "Manage suppliers",
          icon: "people-outline",
          color: "#137333",
          soft: "#E6F4EA",
          onPress: () => navigation.navigate("VendorHome"),
        },
        {
          label: "Invoices",
          caption: "Billing & balance",
          icon: "receipt-outline",
          color: "#B06000",
          soft: "#FEF7E0",
          onPress: () =>
            navigation.navigate("RetailerMore", {
              screen: "RetailerInvoices",
            }),
        },
        {
          label: "Deliveries",
          caption: "Track shipments",
          icon: "truck-outline",
          color: "#7C3AED",
          soft: "#F1ECFB",
          onPress: () => navigation.navigate("RetailerDeliveries"),
        },
      ];
    }

    return [
      {
        label: "Add item",
        caption: "New product",
        icon: "add-outline",
        color: "#1A73E8",
        soft: "#E8F0FE",
        onPress: () =>
          navigation.navigate("WholesalerCatalog", {
            screen: "ProductEditor",
          }),
      },
      {
        label: "Retailers",
        caption: "Partners",
        icon: "people-outline",
        color: "#137333",
        soft: "#E6F4EA",
        onPress: () =>
          navigation.navigate("WholesalerProfile", {
            screen: "RetailerTools",
          }),
      },
      {
        label: "Deliveries",
        caption: "Fulfilment",
        icon: "car-outline",
        color: "#B06000",
        soft: "#FEF7E0",
        onPress: () =>
          navigation.navigate("WholesalerProfile", {
            screen: "Deliveries",
          }),
      },
      {
        label: "Invoices",
        caption: "Billing",
        icon: "receipt-outline",
        color: "#0284C7",
        soft: "#E0F2FE",
        onPress: () =>
          navigation.navigate("WholesalerProfile", {
            screen: "WholesalerInvoices",
          }),
      },
      {
        label: "Payments",
        caption: "Transactions",
        icon: "wallet-outline",
        color: "#137333",
        soft: "#E6F4EA",
        onPress: () =>
          navigation.navigate("WholesalerProfile", {
            screen: "WholesalerPayments",
          }),
      },
      {
        label: "Storefront",
        caption: "Public catalog",
        icon: "storefront-outline",
        color: "#1A73E8",
        soft: "#E8F0FE",
        onPress: () => navigation.navigate("WholesalerCatalog"),
      },
    ];
  }, [navigation, role]);

  const openProfile = () =>
    role === "retailer"
      ? navigation.navigate("RetailerMore", { screen: "Profile" })
      : navigation.navigate("WholesalerProfile", { screen: "ProfileHome" });

  const openActivity = (item) => {
    if (!item?.id) return;
    if (role === "retailer") {
      navigation.navigate("RetailerOrders", {
        screen: "RetailerOrderDetails",
        params: { id: item.id },
      });
    } else {
      navigation.navigate("WholesalerOrders", {
        screen: "WholesalerOrderDetails",
        params: { id: item.id },
      });
    }
  };

  const firstName = user?.name?.trim().split(" ")[0] || "there";
  const businessName =
    user?.business_name ||
    (role === "retailer" ? "Retail Business" : "Wholesale Business");

  const initials = String(user?.business_name || user?.name || "T")
    .trim()
    .charAt(0)
    .toUpperCase();

  const metrics = metricConfig[role] || [];
  const actionColumnWidth = role === "retailer" ? "25%" : "33.33%";
  const dashboardStatus = error
    ? "Unavailable"
    : refreshing
    ? "Refreshing"
    : data
    ? "Updated"
    : loading
    ? "Loading"
    : "Unavailable";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={openProfile}
          style={styles.profileHeaderBadge}
        >
          {user?.logo_url ? (
            <Image
              source={{ uri: user.logo_url }}
              style={styles.headerAvatarImg}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.headerAvatarCircle}>
              <Text style={styles.headerAvatarLetter}>{initials}</Text>
            </View>
          )}
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.greetingTitle}>
              Hello, {firstName}
            </Text>
            <Text numberOfLines={1} style={styles.businessSubtitle}>
              {businessName}
            </Text>
          </View>
        </Pressable>

        <View style={styles.headerRightActions}>
          {role === "wholesaler" && <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retailer requests"
            hitSlop={10}
            onPress={() => navigation.getParent()?.navigate("WholesalerProfile", { screen:"RetailerTools", params:{screen:"RetailerRequests"} })}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.iconButtonPressed,
            ]}
          >
            <Ionicons name="people-outline" size={22} color="#1F1F1F" />
            {alerts.requests > 0 && <View style={styles.headerBadge}><Text style={styles.headerBadgeText}>{alerts.requests > 9 ? "9+" : alerts.requests}</Text></View>}
          </Pressable>}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            hitSlop={10}
            onPress={() => navigation.navigate(role === "wholesaler" ? "WholesalerNotifications" : "RetailerNotifications")}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.iconButtonPressed,
            ]}
          >
            <Ionicons name="notifications-outline" size={22} color="#1F1F1F" />
            {alerts.notifications > 0 && <View style={styles.headerBadge}><Text style={styles.headerBadgeText}>{alerts.notifications > 9 ? "9+" : alerts.notifications}</Text></View>}
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.page,
          { paddingBottom: Math.max(insets.bottom + 28, 40) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Dashboard overview */}
        <View style={styles.heroCard}>
          {/* Subtle Ambient Radial Light */}
          <View style={styles.heroAmbientGlow} />

          <View style={styles.heroHeaderRow}>
            <View style={styles.heroTag}>
              <Text style={styles.heroTagText}>
                {role === "retailer"
                  ? "PURCHASE OVERVIEW"
                  : "BUSINESS OVERVIEW"}
              </Text>
            </View>
            <View style={styles.liveChip}>
              <View
                style={[
                  styles.liveDot,
                  data && !error ? styles.liveDotReady : styles.liveDotMuted,
                ]}
              />
              <Text style={styles.liveChipText}>{dashboardStatus}</Text>
            </View>
          </View>

          <Text numberOfLines={1} style={styles.heroPrimaryAmount}>
            {role === "retailer"
              ? money(stats.purchase_value)
              : `${stats.total_orders ?? 0} Orders`}
          </Text>

          <View style={styles.heroBottomRow}>
            <View style={styles.pendingInfoRow}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color="#E9D5FF"
              />
              <Text numberOfLines={1} style={styles.heroSubText}>
                {stats.pending_orders ?? 0} pending actions
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={
                role === "retailer"
                  ? () =>
                      navigation.navigate("RetailerOrders", {
                        screen: "CreateOrder",
                      })
                  : () =>
                      navigation.navigate("WholesalerCatalog", {
                        screen: "ProductEditor",
                      })
              }
              style={({ pressed }) => [
                styles.heroActionButton,
                pressed && styles.heroActionButtonPressed,
              ]}
            >
              <Ionicons
                name="add-circle"
                size={16}
                color={colors.primaryDark}
              />
              <Text style={styles.heroActionButtonText}>
                {role === "retailer" ? "New Order" : "Add Item"}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionHeadingWrap}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <Text style={styles.sectionSubtitle}>Business services</Text>
        </View>

        <View style={styles.actionsGrid}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={action.onPress}
              style={({ pressed }) => [
                styles.actionItem,
                { width: actionColumnWidth },
                pressed && styles.actionItemPressed,
              ]}
            >
              <View
                style={[
                  styles.actionCircle,
                  { backgroundColor: action.soft },
                ]}
              >
                <Ionicons
                  name={action.icon}
                  size={22}
                  color={action.color}
                />
              </View>
              <Text numberOfLines={1} style={styles.actionLabel}>
                {action.label}
              </Text>
              <Text numberOfLines={1} style={styles.actionCaption}>
                {action.caption}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <DashboardSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <>
            {/* At a Glance Metrics Section */}
            <View style={styles.sectionHeadingWrap}>
              <Text style={styles.sectionTitle}>At a glance</Text>
              <Text style={styles.sectionSubtitle}>Key metrics</Text>
            </View>

            <View style={styles.metricsGrid}>
              {metrics.map((item) => {
                const rawValue = stats[item.key];
                const displayValue = item.isMoney
                  ? money(rawValue)
                  : rawValue ?? 0;

                return (
                  <View key={item.key} style={styles.metricCard}>
                    <View style={styles.metricHeaderRow}>
                      <View
                        style={[
                          styles.metricIconCircle,
                          { backgroundColor: item.soft },
                        ]}
                      >
                        <Ionicons
                          name={item.icon}
                          size={17}
                          color={item.color}
                        />
                      </View>
                      <Text numberOfLines={1} style={styles.metricCardLabel}>
                        {item.label}
                      </Text>
                    </View>
                    <Text numberOfLines={1} style={styles.metricCardValue}>
                      {displayValue}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Recent Activity Section */}
            <View style={styles.sectionHeaderWithLink}>
              <View>
                <Text style={styles.sectionTitle}>Recent activity</Text>
                <Text style={styles.sectionSubtitle}>Latest transactions</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  navigation.navigate(
                    role === "retailer"
                      ? "RetailerOrders"
                      : "WholesalerOrders"
                  )
                }
                style={({ pressed }) => [
                  styles.seeAllButton,
                  pressed && styles.seeAllButtonPressed,
                ]}
              >
                <Text style={styles.seeAllText}>See all</Text>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color="#1A73E8"
                />
              </Pressable>
            </View>

            <View style={styles.feedCard}>
              {recent.length ? (
                recent.slice(0, 6).map((item, index) => {
                  const isLast =
                    index === Math.min(recent.length, 6) - 1;
                  const itemTitle =
                    item.order_no || `Order #${item.id}`;
                  const itemSubtitle =
                    item.business_name ||
                    item.retailer_name ||
                    item.wholesaler_name ||
                    "Merchant Order";

                  return (
                    <Pressable
                      key={item.id || index}
                      onPress={() => openActivity(item)}
                      style={({ pressed }) => [
                        styles.activityRow,
                        isLast && styles.activityRowLast,
                        pressed && styles.activityRowPressed,
                      ]}
                    >
                      <View style={styles.activityIconCircle}>
                        <Ionicons
                          name="cube-outline"
                          size={19}
                          color="#444746"
                        />
                      </View>

                      <View style={styles.activityCopy}>
                        <Text numberOfLines={1} style={styles.activityTitle}>
                          {itemTitle}
                        </Text>
                        <Text numberOfLines={1} style={styles.activitySub}>
                          {itemSubtitle}
                        </Text>
                      </View>

                      <View style={styles.activityRightCol}>
                        <Text style={styles.activityAmount}>
                          {money(item.total_amount)}
                        </Text>
                        <StatusBadge status={item.status} />
                      </View>
                    </Pressable>
                  );
                })
              ) : (
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons
                      name="sparkles-outline"
                      size={24}
                      color="#1A73E8"
                    />
                  </View>
                  <Text style={styles.emptyTitle}>You're all caught up</Text>
                  <Text style={styles.emptyCopy}>
                    New business orders and account activity will appear here.
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.white,
  },
  topBar: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F3F4",
  },
  profileHeaderBadge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginRight: 10,
  },
  headerAvatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EDE7F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  headerAvatarImg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  headerAvatarLetter: {
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: "700",
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  greetingTitle: {
    color: "#1F1F1F",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  businessSubtitle: {
    marginTop: 1,
    color: "#5F6368",
    fontSize: 12,
    fontWeight: "400",
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconButton: {
    position: "relative",
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: colors.white,
  },
  iconButtonPressed: {
    backgroundColor: "#F1F3F4",
  },
  headerBadge: {
    position: "absolute",
    top: 1,
    right: 0,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white,
    borderRadius: 9,
    backgroundColor: colors.red,
  },
  headerBadgeText: {
    color: colors.white,
    fontSize: 8,
    fontWeight: "800",
  },
  page: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: colors.white,
  },
  heroCard: {
    position: "relative",
    overflow: "hidden",
    padding: 20,
    borderRadius: 22,
    backgroundColor: colors.primaryDark,
    marginBottom: 24,
    ...shadow,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 4,
  },
  heroAmbientGlow: {
    position: "absolute",
    top: -65,
    right: -35,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: colors.primary,
    opacity: 0.5,
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroTag: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
  heroTagText: {
    color: "#E9D5FF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  liveChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveDotReady: {
    backgroundColor: "#86EFAC",
  },
  liveDotMuted: {
    backgroundColor: "#E9D5FF",
  },
  liveChipText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  heroPrimaryAmount: {
    marginTop: 18,
    marginBottom: 16,
    color: "#FFFFFF",
    fontSize: 29,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  heroBottomRow: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.16)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  pendingInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  heroSubText: {
    flex: 1,
    color: "#EDE4FF",
    fontSize: 12,
    fontWeight: "600",
  },
  heroActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },
  heroActionButtonPressed: {
    backgroundColor: "#E8F0FE",
    transform: [{ scale: 0.97 }],
  },
  heroActionButtonText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "700",
  },
  sectionHeadingWrap: {
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionHeaderWithLink: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    color: "#1F1F1F",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    marginTop: 2,
    color: "#70757A",
    fontSize: 12,
    fontWeight: "400",
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "#F1F3F4",
  },
  seeAllButtonPressed: {
    backgroundColor: "#E8EAED",
  },
  seeAllText: {
    color: "#1A73E8",
    fontSize: 12,
    fontWeight: "700",
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 18,
    marginBottom: 24,
  },
  actionItem: {
    alignItems: "center",
    paddingHorizontal: 2,
  },
  actionItemPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
  actionCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  actionLabel: {
    color: "#1F1F1F",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    width: "100%",
  },
  actionCaption: {
    marginTop: 1,
    color: "#70757A",
    fontSize: 10,
    textAlign: "center",
    width: "100%",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    marginBottom: 24,
  },
  metricCard: {
    width: "48.2%",
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E8EAED",
  },
  metricHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  metricIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  metricCardLabel: {
    flex: 1,
    color: "#5F6368",
    fontSize: 12,
    fontWeight: "500",
  },
  metricCardValue: {
    color: "#1F1F1F",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  feedCard: {
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E8EAED",
    overflow: "hidden",
    marginBottom: 20,
  },
  activityRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F3F4",
  },
  activityRowLast: {
    borderBottomWidth: 0,
  },
  activityRowPressed: {
    backgroundColor: "#F8F9FA",
  },
  activityIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F3F4",
    alignItems: "center",
    justifyContent: "center",
  },
  activityCopy: {
    flex: 1,
    minWidth: 0,
  },
  activityTitle: {
    color: "#1F1F1F",
    fontSize: 14,
    fontWeight: "600",
  },
  activitySub: {
    marginTop: 2,
    color: "#5F6368",
    fontSize: 12,
  },
  activityRightCol: {
    alignItems: "flex-end",
    gap: 4,
  },
  activityAmount: {
    color: "#1F1F1F",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E8F0FE",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 12,
    color: "#1F1F1F",
    fontSize: 15,
    fontWeight: "700",
  },
  emptyCopy: {
    marginTop: 4,
    color: "#70757A",
    fontSize: 12,
    textAlign: "center",
    maxWidth: 260,
  },
});
