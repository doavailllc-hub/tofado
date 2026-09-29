import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";

import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { colors } from "../../theme/colors";
import { title } from "../../utils/format";
import { friendlyError } from "../../utils/errors";

export const BUSINESS_CATEGORIES = [
  "Grocery & Supermarket",
  "Food Distribution",
  "Fresh Produce",
  "Bakery & Confectionery",
  "Beverages",
  "Frozen Foods",
  "Dairy Products",
  "Meat & Poultry",
  "Cleaning & Household",
  "Personal Care",
  "General Trading",
  "Other",
];

export const SHOP_TYPES = [
  "Retail Shop",
  "Supermarket",
  "Mini Market",
  "Hypermarket",
  "Wholesaler",
  "Distributor",
  "Importer",
  "Manufacturer",
  "Other",
];

const EMPTY_PROFILE = {
  name: "",
  business_name: "",
  email: "",
  phone: "",
  location: "",
  address: "",
  tax_number: "",
  business_category: "",
  shop_type: "",
  description: "",
  website: "",
  logo_url: "",
};

function normalizeProfile(data = {}) {
  return {
    ...EMPTY_PROFILE,
    ...data,
    name: data.name || "",
    business_name: data.business_name || "",
    email: data.email || "",
    phone: data.phone || "",
    location: data.location || "",
    address: data.address || "",
    tax_number: data.tax_number || "",
    business_category: data.business_category || "",
    shop_type: data.shop_type || "",
    description: data.description || "",
    website: data.website || "",
    logo_url: data.logo_url || "",
  };
}

function validateProfile(profile) {
  if (!String(profile.name || "").trim()) return "Contact person name is required.";
  if (!String(profile.business_name || "").trim()) return "Business name is required.";
  if (!String(profile.phone || "").trim()) return "Phone number is required.";
  if (!String(profile.location || "").trim()) return "City or location is required.";
  if (!profile.business_category) return "Select a business category.";
  if (!profile.shop_type) return "Select a shop type.";
  if (
    profile.website &&
    !/^https?:\/\/.+/i.test(String(profile.website).trim())
  ) {
    return "Website must start with http:// or https://";
  }
  return "";
}

function InfoRow({
  icon,
  label,
  value,
  onPress,
  actionIcon,
  actionText,
  isLast = false,
}) {
  const isActionable = Boolean(onPress);

  return (
    <Pressable
      disabled={!isActionable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.infoRow,
        isLast && styles.infoRowLast,
        pressed && isActionable && styles.rowPressed,
      ]}
    >
      <View style={styles.infoIconWrapper}>
        <Ionicons name={icon} size={19} color="#444746" />
      </View>
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text numberOfLines={2} style={styles.infoValue}>
          {value || "—"}
        </Text>
      </View>
      {isActionable && (
        <View style={styles.actionPill}>
          {actionIcon && (
            <Ionicons
              name={actionIcon}
              size={13}
              color={colors.primaryDark}
            />
          )}
          {actionText && <Text style={styles.actionText}>{actionText}</Text>}
          {!actionIcon && !actionText && (
            <Ionicons name="chevron-forward" size={16} color="#747775" />
          )}
        </View>
      )}
    </Pressable>
  );
}

function SectionGroup({ title: sectionTitle, subtitle: sectionSubtitle, children }) {
  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{sectionTitle}</Text>
        {sectionSubtitle ? (
          <Text style={styles.sectionSubtitle}>{sectionSubtitle}</Text>
        ) : null}
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  required = false,
  multiline = false,
  keyboardType = "default",
  autoCapitalize = "sentences",
  editable = true,
  icon,
  helperText,
}) {
  return (
    <View style={styles.formGroup}>
      <Text style={styles.formLabel}>
        {label} {required ? <Text style={styles.requiredStar}>*</Text> : null}
      </Text>
      <View
        style={[
          styles.inputContainer,
          multiline && styles.inputContainerMultiline,
          !editable && styles.inputContainerDisabled,
        ]}
      >
        {icon ? (
          <View style={styles.inputLeadingIcon}>
            <Ionicons name={icon} size={18} color={editable ? "#5F6368" : "#9AA0A6"} />
          </View>
        ) : null}
        <TextInput
          style={[styles.textInput, multiline && styles.textInputMultiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9AA0A6"
          editable={editable}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          underlineColorAndroid="transparent"
        />
      </View>
      {helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

function PickerModal({ visible, title: modalTitle, options, selected, onSelect, onClose }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    return options.filter((item) =>
      item.toLowerCase().includes(search.toLowerCase().trim())
    );
  }, [options, search]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <Pressable hitSlop={12} onPress={onClose} style={styles.modalCloseButton}>
              <Ionicons name="close" size={22} color="#1F1F1F" />
            </Pressable>
          </View>

          {options.length > 8 ? (
            <View style={styles.modalSearchBox}>
              <Ionicons name="search" size={17} color="#5F6368" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search options..."
                placeholderTextColor="#9AA0A6"
                style={styles.modalSearchInput}
              />
              {search ? (
                <Pressable onPress={() => setSearch("")}>
                  <Ionicons name="close-circle" size={16} color="#747775" />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
            {filtered.map((item) => {
              const isSelected = selected === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.modalOptionRow,
                    isSelected && styles.modalOptionRowSelected,
                    pressed && styles.modalOptionRowPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      isSelected && styles.modalOptionTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                  {isSelected ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primaryDark} />
                  ) : (
                    <View style={styles.modalOptionRadio} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, logout, refreshUser } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState(normalizeProfile(user));
  const [originalData, setOriginalData] = useState(normalizeProfile(user));

  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [shopTypePickerOpen, setShopTypePickerOpen] = useState(false);

  const canGoBack = navigation.canGoBack();

  const loadFullProfile = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      setErrorMessage("");
      setStatusMessage("");

      const response = await api.get("/profile");
      const normalized = normalizeProfile(response.data || user);
      setProfileData(normalized);
      setOriginalData(normalized);

      if (typeof refreshUser === "function") {
        await refreshUser();
      }
    } catch (err) {
      setErrorMessage(
        friendlyError(err, "Unable to load business profile.")
      );
    } finally {
      setRefreshing(false);
    }
  }, [refreshUser, user]);

  useEffect(() => {
    loadFullProfile();
  }, []);

  const hasFormChanges = useMemo(() => {
    return JSON.stringify(profileData) !== JSON.stringify(originalData);
  }, [profileData, originalData]);

  const updateField = (key, value) => {
    setErrorMessage("");
    setStatusMessage("");
    setProfileData((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handlePickLogo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission Required",
        "Allow photo library access to choose your business logo."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets || !result.assets.length) return;

    const asset = result.assets[0];
    try {
      setUploadingLogo(true);
      setErrorMessage("");
      setStatusMessage("");

      const formData = new FormData();
      const fileName = asset.fileName || `logo-${Date.now()}.jpg`;
      const mimeType = asset.mimeType || "image/jpeg";

      formData.append("logo", {
        uri: asset.uri,
        name: fileName,
        type: mimeType,
      });

      const response = await api.post("/profile/logo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const updatedLogoUrl = response.data?.logo_url || asset.uri;

      setProfileData((current) => ({
        ...current,
        logo_url: updatedLogoUrl,
      }));
      setOriginalData((current) => ({
        ...current,
        logo_url: updatedLogoUrl,
      }));

      if (typeof refreshUser === "function") {
        await refreshUser();
      }

      setStatusMessage("Business logo updated successfully.");
    } catch (err) {
      setErrorMessage(
        friendlyError(err, "Unable to upload business logo. Use JPG, PNG or WEBP up to 5MB.")
      );
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    if (!profileData.logo_url) return;

    Alert.alert(
      "Remove Logo",
      "Are you sure you want to remove your company logo?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setRemovingLogo(true);
              setErrorMessage("");
              setStatusMessage("");

              await api.delete("/profile/logo");

              setProfileData((current) => ({
                ...current,
                logo_url: "",
              }));
              setOriginalData((current) => ({
                ...current,
                logo_url: "",
              }));

              if (typeof refreshUser === "function") {
                await refreshUser();
              }

              setStatusMessage("Business logo removed.");
            } catch (err) {
              setErrorMessage(
                friendlyError(err, "Unable to remove business logo.")
              );
            } finally {
              setRemovingLogo(false);
            }
          },
        },
      ]
    );
  };

  const handleSaveProfile = async () => {
    const validationError = validateProfile(profileData);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");
      setStatusMessage("");

      const payload = {
        name: profileData.name.trim(),
        business_name: profileData.business_name.trim(),
        phone: profileData.phone.trim(),
        location: profileData.location.trim(),
        address: profileData.address.trim(),
        tax_number: profileData.tax_number.trim(),
        business_category: profileData.business_category.trim(),
        shop_type: profileData.shop_type.trim(),
        description: profileData.description.trim(),
        website: profileData.website.trim(),
      };

      const response = await api.put("/profile", payload);
      const updated = normalizeProfile({
        ...profileData,
        ...(response.data || {}),
      });

      setProfileData(updated);
      setOriginalData(updated);
      setIsEditing(false);
      setStatusMessage("Business profile updated successfully.");

      if (typeof refreshUser === "function") {
        await refreshUser();
      }
    } catch (err) {
      setErrorMessage(
        friendlyError(err, "Unable to update business profile.")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (hasFormChanges) {
      Alert.alert(
        "Discard Changes",
        "You have unsaved edits. Are you sure you want to discard them?",
        [
          { text: "Keep Editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              setProfileData(originalData);
              setErrorMessage("");
              setStatusMessage("");
              setIsEditing(false);
            },
          },
        ]
      );
    } else {
      setErrorMessage("");
      setStatusMessage("");
      setIsEditing(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out of your account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              setSigningOut(true);
              await logout();
            } catch (err) {
              Alert.alert(
                "Sign Out Error",
                friendlyError(err, "Failed to sign out. Please try again.")
              );
            } finally {
              setSigningOut(false);
            }
          },
        },
      ]
    );
  };

  const handleEmailPress = () => {
    if (profileData.email) {
      Linking.openURL(`mailto:${profileData.email}`).catch(() => {});
    }
  };

  const handlePhonePress = () => {
    if (profileData.phone) {
      Linking.openURL(`tel:${profileData.phone}`).catch(() => {});
    }
  };

  const handleWebsitePress = () => {
    if (profileData.website) {
      const url = /^https?:\/\//i.test(profileData.website)
        ? profileData.website
        : `https://${profileData.website}`;
      Linking.openURL(url).catch(() => {});
    }
  };

  const businessName =
    profileData.business_name || profileData.name || "Tofado Wholesaler Business";
  const contactName = profileData.name || "Authorized Merchant";
  const userRole = user?.role || "merchant";
  const initials = String(businessName || contactName || "T")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Top Google-style Navigation App Bar */}
      <View style={styles.topBar}>
        {isEditing ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel edit"
            hitSlop={12}
            onPress={handleCancelEdit}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.iconButtonPressed,
            ]}
          >
            <Ionicons name="close" size={24} color="#1F1F1F" />
          </Pressable>
        ) : canGoBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.iconButtonPressed,
            ]}
          >
            <Ionicons name="arrow-back" size={22} color="#1F1F1F" />
          </Pressable>
        ) : (
          <View style={styles.brandIconCircle}>
            <Ionicons name="business" size={18} color={colors.primaryDark} />
          </View>
        )}

        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle}>
            {isEditing ? "Edit Business Profile" : "Merchant Profile"}
          </Text>
        </View>

        {isEditing ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save profile"
            hitSlop={12}
            disabled={saving}
            onPress={handleSaveProfile}
            style={({ pressed }) => [
              styles.saveHeaderButton,
              pressed && styles.saveHeaderButtonPressed,
              saving && styles.disabled,
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveHeaderButtonText}>Save</Text>
            )}
          </Pressable>
        ) : (
          <View style={styles.topBarRightActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
              hitSlop={10}
              onPress={() => setIsEditing(true)}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.iconButtonPressed,
              ]}
            >
              <Ionicons name="pencil-outline" size={20} color="#1F1F1F" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh profile"
              hitSlop={10}
              onPress={() => loadFullProfile(true)}
              disabled={refreshing}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.iconButtonPressed,
              ]}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="refresh-outline" size={22} color="#1F1F1F" />
              )}
            </Pressable>
          </View>
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.page,
            { paddingBottom: Math.max(insets.bottom + 28, 40) },
          ]}
          refreshControl={
            !isEditing ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadFullProfile(true)}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            ) : undefined
          }
        >
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={18} color="#C5221F" />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          ) : null}

          {statusMessage ? (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#137333" />
              <Text style={styles.successBannerText}>{statusMessage}</Text>
            </View>
          ) : null}

          {/* VIEW MODE */}
          {!isEditing ? (
            <>
              {/* Google Pay Style Hero Profile Section */}
              <View style={styles.heroCard}>
                <View style={styles.avatarWrapper}>
                  {profileData.logo_url ? (
                    <Image
                      source={{ uri: profileData.logo_url }}
                      style={styles.avatarImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarLetter}>{initials}</Text>
                    </View>
                  )}
                  <Pressable
                    hitSlop={8}
                    disabled={uploadingLogo}
                    onPress={handlePickLogo}
                    style={styles.avatarEditOverlay}
                  >
                    {uploadingLogo ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons name="camera" size={14} color="#FFFFFF" />
                    )}
                  </Pressable>
                </View>

                <Text numberOfLines={1} style={styles.heroBusinessName}>
                  {businessName}
                </Text>
                <Text numberOfLines={1} style={styles.heroContactEmail}>
                  {profileData.email || contactName}
                </Text>

                {/* Google Style Pills */}
                <View style={styles.chipsRow}>
                  <View style={styles.roleChip}>
                    <Ionicons
                      name={
                        userRole === "wholesaler"
                          ? "briefcase-outline"
                          : "storefront-outline"
                      }
                      size={13}
                      color={colors.primaryDark}
                    />
                    <Text style={styles.roleChipText}>{title(userRole)}</Text>
                  </View>

                  <View style={styles.statusChip}>
                    <View style={styles.greenDot} />
                    <Text style={styles.statusChipText}>Verified Merchant</Text>
                  </View>

                  {profileData.id ? (
                    <View style={styles.idChip}>
                      <Text style={styles.idChipText}>ID: #{profileData.id}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Edit Profile Quick Button */}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setIsEditing(true)}
                  style={({ pressed }) => [
                    styles.heroEditButton,
                    pressed && styles.heroEditButtonPressed,
                  ]}
                >
                  <Ionicons name="pencil-outline" size={15} color="#1A73E8" />
                  <Text style={styles.heroEditButtonText}>Edit business profile</Text>
                </Pressable>

                {/* Quick Info Strip */}
                <View style={styles.quickStrip}>
                  <View style={styles.stripCol}>
                    <Text style={styles.stripLabel}>Category</Text>
                    <Text numberOfLines={1} style={styles.stripValue}>
                      {profileData.business_category || "General Merchant"}
                    </Text>
                  </View>
                  <View style={styles.stripDivider} />
                  <View style={styles.stripCol}>
                    <Text style={styles.stripLabel}>Location</Text>
                    <Text numberOfLines={1} style={styles.stripValue}>
                      {profileData.location || "Not specified"}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Business Information Section */}
              <SectionGroup
                title="Business details"
                subtitle="Registered company information"
              >
                <InfoRow
                  icon="business-outline"
                  label="Legal business name"
                  value={profileData.business_name}
                />
                <InfoRow
                  icon="grid-outline"
                  label="Industry & category"
                  value={profileData.business_category}
                />
                <InfoRow
                  icon="storefront-outline"
                  label="Shop / establishment type"
                  value={profileData.shop_type}
                />
                <InfoRow
                  icon="location-outline"
                  label="Operating city & address"
                  value={
                    [profileData.location, profileData.address]
                      .filter(Boolean)
                      .join(" · ") || "Location not specified"
                  }
                />
                {profileData.tax_number ? (
                  <InfoRow
                    icon="document-text-outline"
                    label="Tax / CR number"
                    value={profileData.tax_number}
                  />
                ) : null}
                {profileData.website ? (
                  <InfoRow
                    icon="globe-outline"
                    label="Website"
                    value={profileData.website}
                    onPress={handleWebsitePress}
                    actionIcon="open-outline"
                    actionText="Visit"
                  />
                ) : null}
                {profileData.description ? (
                  <InfoRow
                    icon="information-circle-outline"
                    label="About business"
                    value={profileData.description}
                    isLast={true}
                  />
                ) : null}
              </SectionGroup>

              {/* Contact Details Section */}
              <SectionGroup
                title="Contact & communication"
                subtitle="Primary account contact details"
              >
                <InfoRow
                  icon="person-outline"
                  label="Authorized contact"
                  value={contactName}
                />
                <InfoRow
                  icon="mail-outline"
                  label="Email address"
                  value={profileData.email}
                  onPress={profileData.email ? handleEmailPress : undefined}
                  actionIcon={profileData.email ? "send-outline" : undefined}
                  actionText={profileData.email ? "Email" : undefined}
                />
                {profileData.phone ? (
                  <InfoRow
                    icon="call-outline"
                    label="Phone number"
                    value={profileData.phone}
                    onPress={handlePhonePress}
                    actionIcon="call-outline"
                    actionText="Call"
                  />
                ) : (
                  <InfoRow
                    icon="call-outline"
                    label="Phone number"
                    value="Not provided"
                  />
                )}
                <InfoRow
                  icon="shield-checkmark-outline"
                  label="Account privileges"
                  value={`${title(userRole)} account permissions`}
                  isLast={true}
                />
              </SectionGroup>

              {/* System & Security Section */}
              <SectionGroup
                title="System & security"
                subtitle="App version and cloud synchronization"
              >
                <InfoRow
                  icon="cloud-done-outline"
                  label="Cloud synchronization"
                  value="Active · Synced with Tofado Wholesaler Cloud"
                />
                <InfoRow
                  icon="phone-portrait-outline"
                  label="Application version"
                  value="Tofado Wholesaler Mobile v1.0.0"
                  isLast={true}
                />
              </SectionGroup>

              {/* Google-style Sign Out Button */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign out of account"
                disabled={signingOut}
                onPress={handleSignOut}
                style={({ pressed }) => [
                  styles.signOutButton,
                  pressed && !signingOut && styles.signOutPressed,
                  signingOut && styles.signOutDisabled,
                ]}
              >
                {signingOut ? (
                  <ActivityIndicator size="small" color={colors.red} />
                ) : (
                  <>
                    <Ionicons name="log-out-outline" size={19} color={colors.red} />
                    <Text style={styles.signOutText}>Sign out of merchant account</Text>
                  </>
                )}
              </Pressable>

              {/* Google-style Footer */}
              <View style={styles.footerWrap}>
                <Text style={styles.footerText}>
                  Signed in as {profileData.email || contactName}
                </Text>
                <Text style={styles.footerSub}>
                  Tofado Wholesaler Services
                </Text>
              </View>
            </>
          ) : (
            /* EDIT MODE */
            <View style={styles.editForm}>
              {/* Logo Edit Section */}
              <View style={styles.logoEditCard}>
                <View style={styles.logoEditAvatarWrapper}>
                  {profileData.logo_url ? (
                    <Image
                      source={{ uri: profileData.logo_url }}
                      style={styles.logoEditImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.logoEditFallback}>
                      <Text style={styles.logoEditInitials}>{initials}</Text>
                    </View>
                  )}
                  {uploadingLogo || removingLogo ? (
                    <View style={styles.logoEditLoadingOverlay}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    </View>
                  ) : null}
                </View>

                <View style={styles.logoEditActions}>
                  <Pressable
                    disabled={uploadingLogo || removingLogo}
                    onPress={handlePickLogo}
                    style={({ pressed }) => [
                      styles.logoActionButton,
                      pressed && styles.logoActionButtonPressed,
                    ]}
                  >
                    <Ionicons name="cloud-upload-outline" size={16} color="#1A73E8" />
                    <Text style={styles.logoActionButtonText}>
                      {profileData.logo_url ? "Change logo" : "Upload logo"}
                    </Text>
                  </Pressable>

                  {profileData.logo_url ? (
                    <Pressable
                      disabled={uploadingLogo || removingLogo}
                      onPress={handleRemoveLogo}
                      style={({ pressed }) => [
                        styles.logoRemoveButton,
                        pressed && styles.logoRemoveButtonPressed,
                      ]}
                    >
                      <Ionicons name="trash-outline" size={15} color="#D93025" />
                      <Text style={styles.logoRemoveButtonText}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Text style={styles.logoHelpText}>
                  JPG, PNG, or WEBP up to 5 MB.
                </Text>
              </View>

              {/* Form Fields Card */}
              <View style={styles.editSectionCard}>
                <Text style={styles.editCardHeading}>Company & Contact Information</Text>

                <FormInput
                  label="Business name"
                  required
                  icon="business-outline"
                  value={profileData.business_name}
                  onChangeText={(v) => updateField("business_name", v)}
                  placeholder="Registered business name"
                />

                <FormInput
                  label="Contact person name"
                  required
                  icon="person-outline"
                  value={profileData.name}
                  onChangeText={(v) => updateField("name", v)}
                  placeholder="Full contact name"
                />

                {/* Business Category Selector */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    Business category <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <Pressable
                    onPress={() => setCategoryPickerOpen(true)}
                    style={styles.pickerSelector}
                  >
                    <View style={styles.inputLeadingIcon}>
                      <Ionicons name="grid-outline" size={18} color="#5F6368" />
                    </View>
                    <Text
                      style={[
                        styles.pickerSelectorText,
                        !profileData.business_category && styles.pickerPlaceholder,
                      ]}
                    >
                      {profileData.business_category || "Select category"}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color="#747775" />
                  </Pressable>
                </View>

                {/* Shop Type Selector */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    Shop type <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <Pressable
                    onPress={() => setShopTypePickerOpen(true)}
                    style={styles.pickerSelector}
                  >
                    <View style={styles.inputLeadingIcon}>
                      <Ionicons name="storefront-outline" size={18} color="#5F6368" />
                    </View>
                    <Text
                      style={[
                        styles.pickerSelectorText,
                        !profileData.shop_type && styles.pickerPlaceholder,
                      ]}
                    >
                      {profileData.shop_type || "Select shop type"}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color="#747775" />
                  </Pressable>
                </View>

                <FormInput
                  label="Phone number"
                  required
                  icon="call-outline"
                  value={profileData.phone}
                  onChangeText={(v) => updateField("phone", v)}
                  placeholder="+966 5x xxx xxxx"
                  keyboardType="phone-pad"
                />

                <FormInput
                  label="City / Location"
                  required
                  icon="location-outline"
                  value={profileData.location}
                  onChangeText={(v) => updateField("location", v)}
                  placeholder="e.g. Riyadh, Saudi Arabia"
                />

                <FormInput
                  label="Operating address"
                  icon="map-outline"
                  value={profileData.address}
                  onChangeText={(v) => updateField("address", v)}
                  placeholder="Street, District, Building number"
                />

                <FormInput
                  label="Tax / CR number"
                  icon="document-text-outline"
                  value={profileData.tax_number}
                  onChangeText={(v) => updateField("tax_number", v)}
                  placeholder="Commercial registration or VAT number"
                />

                <FormInput
                  label="Website URL"
                  icon="globe-outline"
                  value={profileData.website}
                  onChangeText={(v) => updateField("website", v)}
                  placeholder="https://yourbusiness.com"
                  keyboardType="url"
                  autoCapitalize="none"
                  helperText="Must start with http:// or https://"
                />

                <FormInput
                  label="Business description"
                  icon="information-circle-outline"
                  value={profileData.description}
                  onChangeText={(v) => updateField("description", v)}
                  placeholder="Describe your products, wholesale supply, or retail services..."
                  multiline
                />

                <FormInput
                  label="Account email"
                  icon="lock-closed-outline"
                  value={profileData.email}
                  editable={false}
                  helperText="Email is protected and cannot be changed directly."
                />
              </View>

              {/* Bottom Action Buttons */}
              <View style={styles.editBottomActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={handleSaveProfile}
                  style={({ pressed }) => [
                    styles.primarySaveButton,
                    pressed && styles.primarySaveButtonPressed,
                    saving && styles.disabled,
                  ]}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={19} color="#FFFFFF" />
                      <Text style={styles.primarySaveButtonText}>Save changes</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={handleCancelEdit}
                  style={({ pressed }) => [
                    styles.cancelEditButton,
                    pressed && styles.cancelEditButtonPressed,
                  ]}
                >
                  <Text style={styles.cancelEditButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Category Picker Modal */}
      <PickerModal
        visible={categoryPickerOpen}
        title="Select Business Category"
        options={BUSINESS_CATEGORIES}
        selected={profileData.business_category}
        onSelect={(item) => updateField("business_category", item)}
        onClose={() => setCategoryPickerOpen(false)}
      />

      {/* Shop Type Picker Modal */}
      <PickerModal
        visible={shopTypePickerOpen}
        title="Select Shop Type"
        options={SHOP_TYPES}
        selected={profileData.shop_type}
        onSelect={(item) => updateField("shop_type", item)}
        onClose={() => setShopTypePickerOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  flex: {
    flex: 1,
  },
  topBar: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F3F4",
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
  },
  iconButtonPressed: {
    backgroundColor: "#F1F3F4",
  },
  brandIconCircle: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: colors.primarySoft,
  },
  topBarCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  topBarTitle: {
    color: "#1F1F1F",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  topBarRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  saveHeaderButton: {
    minHeight: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: "#1A73E8",
    alignItems: "center",
    justifyContent: "center",
  },
  saveHeaderButtonPressed: {
    backgroundColor: "#1557B0",
    transform: [{ scale: 0.97 }],
  },
  saveHeaderButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  page: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: "#FFFFFF",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: "#FEF7F6",
    borderWidth: 1,
    borderColor: "#FCE8E6",
  },
  errorBannerText: {
    flex: 1,
    color: "#C5221F",
    fontSize: 13,
    fontWeight: "500",
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: "#E6F4EA",
    borderWidth: 1,
    borderColor: "#CEEAD6",
  },
  successBannerText: {
    flex: 1,
    color: "#137333",
    fontSize: 13,
    fontWeight: "600",
  },
  heroCard: {
    alignItems: "center",
    paddingVertical: 22,
    paddingHorizontal: 18,
    marginBottom: 24,
    borderRadius: 20,
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#E8EAED",
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 12,
  },
  avatarCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#EDE7F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  avatarLetter: {
    color: colors.primaryDark,
    fontSize: 32,
    fontWeight: "700",
  },
  avatarImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  avatarEditOverlay: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#1A73E8",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  heroBusinessName: {
    color: "#1F1F1F",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  heroContactEmail: {
    marginTop: 4,
    color: "#5F6368",
    fontSize: 13,
    fontWeight: "400",
    textAlign: "center",
  },
  chipsRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  roleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 16,
    backgroundColor: "#EDE7F6",
  },
  roleChipText: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "700",
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 16,
    backgroundColor: "#E6F4EA",
  },
  greenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#137333",
  },
  statusChipText: {
    color: "#137333",
    fontSize: 11,
    fontWeight: "700",
  },
  idChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DADCE0",
  },
  idChipText: {
    color: "#5F6368",
    fontSize: 11,
    fontWeight: "600",
  },
  heroEditButton: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DADCE0",
  },
  heroEditButtonPressed: {
    backgroundColor: "#F1F3F4",
  },
  heroEditButtonText: {
    color: "#1A73E8",
    fontSize: 13,
    fontWeight: "600",
  },
  quickStrip: {
    width: "100%",
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#E8EAED",
    flexDirection: "row",
    alignItems: "center",
  },
  stripCol: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  stripLabel: {
    color: "#70757A",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  stripValue: {
    marginTop: 3,
    color: "#1F1F1F",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  stripDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#E8EAED",
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionHeader: {
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    color: "#1F1F1F",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    marginTop: 2,
    color: "#5F6368",
    fontSize: 12,
    fontWeight: "400",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8EAED",
    overflow: "hidden",
  },
  infoRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F3F4",
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  rowPressed: {
    backgroundColor: "#F8F9FA",
  },
  infoIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F1F3F4",
    alignItems: "center",
    justifyContent: "center",
  },
  infoCopy: {
    flex: 1,
    minWidth: 0,
  },
  infoLabel: {
    color: "#5F6368",
    fontSize: 11,
    fontWeight: "500",
  },
  infoValue: {
    marginTop: 2,
    color: "#1F1F1F",
    fontSize: 14,
    fontWeight: "600",
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#F1F3F4",
  },
  actionText: {
    color: "#1A73E8",
    fontSize: 12,
    fontWeight: "600",
  },
  signOutButton: {
    minHeight: 50,
    marginTop: 8,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 25,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DADCE0",
  },
  signOutPressed: {
    backgroundColor: "#FEF7F6",
    borderColor: "#FCE8E6",
  },
  signOutDisabled: {
    opacity: 0.6,
  },
  signOutText: {
    color: "#D93025",
    fontSize: 14,
    fontWeight: "600",
  },
  footerWrap: {
    alignItems: "center",
    paddingVertical: 12,
    gap: 2,
  },
  footerText: {
    color: "#70757A",
    fontSize: 12,
    textAlign: "center",
  },
  footerSub: {
    color: "#9AA0A6",
    fontSize: 11,
    textAlign: "center",
  },
  editForm: {
    gap: 16,
    paddingBottom: 24,
  },
  logoEditCard: {
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#E8EAED",
  },
  logoEditAvatarWrapper: {
    position: "relative",
    marginBottom: 14,
  },
  logoEditImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  logoEditFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#EDE7F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  logoEditInitials: {
    color: colors.primaryDark,
    fontSize: 34,
    fontWeight: "700",
  },
  logoEditLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 40,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoEditActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DADCE0",
  },
  logoActionButtonPressed: {
    backgroundColor: "#F1F3F4",
  },
  logoActionButtonText: {
    color: "#1A73E8",
    fontSize: 13,
    fontWeight: "600",
  },
  logoRemoveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#FEF7F6",
    borderWidth: 1,
    borderColor: "#FCE8E6",
  },
  logoRemoveButtonPressed: {
    backgroundColor: "#FAD2CF",
  },
  logoRemoveButtonText: {
    color: "#D93025",
    fontSize: 13,
    fontWeight: "600",
  },
  logoHelpText: {
    marginTop: 10,
    color: "#70757A",
    fontSize: 11,
  },
  editSectionCard: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAED",
  },
  editCardHeading: {
    marginBottom: 16,
    color: "#1F1F1F",
    fontSize: 16,
    fontWeight: "700",
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    marginBottom: 6,
    color: "#444746",
    fontSize: 13,
    fontWeight: "600",
  },
  requiredStar: {
    color: "#D93025",
  },
  inputContainer: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DADCE0",
    backgroundColor: "#FFFFFF",
  },
  inputContainerMultiline: {
    minHeight: 90,
    alignItems: "flex-start",
    paddingVertical: 10,
  },
  inputContainerDisabled: {
    backgroundColor: "#F8F9FA",
    borderColor: "#E8EAED",
  },
  inputLeadingIcon: {
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  textInput: {
    flex: 1,
    color: "#1F1F1F",
    fontSize: 14,
    paddingVertical: 8,
  },
  textInputMultiline: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  helperText: {
    marginTop: 4,
    color: "#70757A",
    fontSize: 11,
  },
  pickerSelector: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DADCE0",
    backgroundColor: "#FFFFFF",
  },
  pickerSelectorText: {
    flex: 1,
    color: "#1F1F1F",
    fontSize: 14,
  },
  pickerPlaceholder: {
    color: "#9AA0A6",
  },
  editBottomActions: {
    gap: 10,
    marginTop: 8,
  },
  primarySaveButton: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 25,
    backgroundColor: "#1A73E8",
  },
  primarySaveButtonPressed: {
    backgroundColor: "#1557B0",
    transform: [{ scale: 0.985 }],
  },
  primarySaveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  cancelEditButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: "#F1F3F4",
  },
  cancelEditButtonPressed: {
    backgroundColor: "#E8EAED",
  },
  cancelEditButtonText: {
    color: "#444746",
    fontSize: 14,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    maxHeight: "78%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  modalTitle: {
    color: "#1F1F1F",
    fontSize: 17,
    fontWeight: "700",
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#F1F3F4",
  },
  modalSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F1F3F4",
    marginBottom: 12,
  },
  modalSearchInput: {
    flex: 1,
    color: "#1F1F1F",
    fontSize: 14,
    paddingVertical: 0,
  },
  modalList: {
    maxHeight: 380,
  },
  modalOptionRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F3F4",
  },
  modalOptionRowSelected: {
    backgroundColor: "#EDE7F6",
  },
  modalOptionRowPressed: {
    backgroundColor: "#F8F9FA",
  },
  modalOptionText: {
    color: "#1F1F1F",
    fontSize: 14,
    fontWeight: "500",
  },
  modalOptionTextSelected: {
    color: colors.primaryDark,
    fontWeight: "700",
  },
  modalOptionRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#DADCE0",
  },
});
