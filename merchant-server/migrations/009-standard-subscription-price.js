export async function up(connection) {
  await connection.query("UPDATE merchant_subscriptions SET plan_code='growth' WHERE plan_code IN ('starter','scale')");
  await connection.query("ALTER TABLE merchant_subscriptions MODIFY plan_code ENUM('starter','growth','scale') NOT NULL DEFAULT 'growth'");
}
