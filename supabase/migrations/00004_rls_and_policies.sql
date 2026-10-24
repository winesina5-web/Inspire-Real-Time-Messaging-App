-- ==============================================================================
-- Migration 00004: 100% Comprehensive Row Level Security (RLS) & Policies
-- Inspire — Real-Time Messaging App
-- ==============================================================================

-- Helper function to check if current user is an Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Enable RLS across EVERY single public table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_dismissals ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.starred_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pinned_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_folder_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pinned_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.muted_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secret_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.view_once_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_preview_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_lock_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_translations_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slow_mode_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.read_later ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_summaries_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_split_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_emoji ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.highlight_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_quality_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incognito_mode ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_recovery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_capsules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_previews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dismissed_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archived_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clipboard_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_conversation_analytics_cache ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- Table Policies
-- ==============================================================================

-- 1. Profiles
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 2. Contacts
CREATE POLICY "contacts_select" ON public.contacts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "contacts_insert" ON public.contacts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "contacts_delete" ON public.contacts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. Blocked Users
CREATE POLICY "blocked_select" ON public.blocked_users FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
CREATE POLICY "blocked_insert" ON public.blocked_users FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "blocked_delete" ON public.blocked_users FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

-- 4. Messages (1:1 and Group)
CREATE POLICY "messages_select_participant" ON public.messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "messages_select_admin" ON public.messages FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "messages_insert_sender" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "messages_update_sender" ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "messages_update_receiver" ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- 5. Reactions
CREATE POLICY "reactions_select" ON public.reactions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_id AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid() OR public.is_admin())
  ));
CREATE POLICY "reactions_insert" ON public.reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reactions_update" ON public.reactions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reactions_delete" ON public.reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 6. Reports
CREATE POLICY "reports_select_reporter" ON public.reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
CREATE POLICY "reports_select_admin" ON public.reports FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "reports_insert" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "reports_update_admin" ON public.reports FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 7. Admin Audit Log (Append-only by Admin)
CREATE POLICY "audit_select_admin" ON public.admin_audit_log FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "audit_insert_admin" ON public.admin_audit_log FOR INSERT TO authenticated WITH CHECK (public.is_admin() AND auth.uid() = admin_id);

-- 8. AI Usage Log
CREATE POLICY "ai_usage_select_admin" ON public.ai_usage_log FOR SELECT TO authenticated USING (public.is_admin());

-- 9. App Settings
CREATE POLICY "settings_select" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_update_admin" ON public.app_settings FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 10. Broadcasts & Dismissals
CREATE POLICY "broadcasts_select" ON public.broadcasts FOR SELECT TO authenticated USING (true);
CREATE POLICY "broadcasts_admin" ON public.broadcasts FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "dismissals_self" ON public.broadcast_dismissals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 11. Groups & Group Members
CREATE POLICY "groups_select" ON public.groups FOR SELECT TO authenticated
  USING (is_public = true OR EXISTS (SELECT 1 FROM public.group_members WHERE group_id = id AND user_id = auth.uid()) OR public.is_admin());
CREATE POLICY "groups_insert" ON public.groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "groups_update" ON public.groups FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.group_members WHERE group_id = id AND user_id = auth.uid() AND role = 'admin') OR public.is_admin())
  WITH CHECK (EXISTS (SELECT 1 FROM public.group_members WHERE group_id = id AND user_id = auth.uid() AND role = 'admin') OR public.is_admin());

CREATE POLICY "group_members_select" ON public.group_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_id AND gm.user_id = auth.uid()) OR public.is_admin());
CREATE POLICY "group_members_insert" ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_members.group_id AND user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "group_members_delete" ON public.group_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_members.group_id AND user_id = auth.uid() AND role = 'admin'));

-- 12. Group Messages
CREATE POLICY "group_messages_select" ON public.group_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_messages.group_id AND user_id = auth.uid()) OR public.is_admin());
CREATE POLICY "group_messages_insert" ON public.group_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_messages.group_id AND user_id = auth.uid()));
CREATE POLICY "group_messages_update" ON public.group_messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);

-- 13. Message Edits, Starred, and Pinned Messages
CREATE POLICY "message_edits_select" ON public.message_edits FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid() OR public.is_admin())));
CREATE POLICY "message_edits_insert" ON public.message_edits FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND m.sender_id = auth.uid()));

CREATE POLICY "starred_messages_self" ON public.starred_messages FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pinned_messages_select" ON public.pinned_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "pinned_messages_insert" ON public.pinned_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = pinned_by);
CREATE POLICY "pinned_messages_delete" ON public.pinned_messages FOR DELETE TO authenticated USING (auth.uid() = pinned_by OR public.is_admin());

-- 14. Calls
CREATE POLICY "calls_select" ON public.calls FOR SELECT TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = callee_id OR public.is_admin());
CREATE POLICY "calls_insert" ON public.calls FOR INSERT TO authenticated WITH CHECK (auth.uid() = caller_id);
CREATE POLICY "calls_update" ON public.calls FOR UPDATE TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = callee_id) WITH CHECK (auth.uid() = caller_id OR auth.uid() = callee_id);

-- 15. Statuses & Reactions
CREATE POLICY "statuses_select" ON public.statuses FOR SELECT TO authenticated
  USING (expires_at > now() AND (auth.uid() = user_id OR privacy = 'contacts' OR public.is_admin()));
CREATE POLICY "statuses_insert" ON public.statuses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "statuses_delete" ON public.statuses FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "status_views_select" ON public.status_views FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.statuses s WHERE s.id = status_id AND s.user_id = auth.uid()) OR auth.uid() = viewer_id);
CREATE POLICY "status_views_insert" ON public.status_views FOR INSERT TO authenticated WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY "status_reactions_all" ON public.status_reactions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 16. Polls & Votes
CREATE POLICY "polls_select" ON public.polls FOR SELECT TO authenticated USING (true);
CREATE POLICY "poll_options_select" ON public.poll_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "poll_votes_all" ON public.poll_votes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 17. Folders, Pinned, Muted, and Secret Chats
CREATE POLICY "folders_self" ON public.chat_folders FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "folder_members_self" ON public.chat_folder_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_folders f WHERE f.id = folder_id AND f.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.chat_folders f WHERE f.id = folder_id AND f.user_id = auth.uid()));

CREATE POLICY "pinned_chats_self" ON public.pinned_chats FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "muted_chats_self" ON public.muted_chats FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "secret_chats_self" ON public.secret_chats FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 18. View Once Media
CREATE POLICY "view_once_select" ON public.view_once_media FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid())));
CREATE POLICY "view_once_update" ON public.view_once_media FOR UPDATE TO authenticated
  USING (opened_by IS NULL OR opened_by = auth.uid())
  WITH CHECK (opened_by = auth.uid());

-- 19. User Sessions & Privacy Settings
CREATE POLICY "user_sessions_self" ON public.user_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "privacy_settings_select" ON public.privacy_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "privacy_settings_update" ON public.privacy_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "privacy_settings_insert" ON public.privacy_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 20. Support Tickets & Moderation Rules
CREATE POLICY "support_tickets_user" ON public.support_tickets FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "support_messages_user" ON public.support_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR public.is_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR public.is_admin())));

CREATE POLICY "moderation_rules_select" ON public.moderation_rules FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "moderation_rules_admin" ON public.moderation_rules FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin_roles_select" ON public.admin_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "feature_flags_select" ON public.feature_flags FOR SELECT TO authenticated USING (true);
CREATE POLICY "scheduled_broadcasts_admin" ON public.scheduled_broadcasts FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "link_preview_select" ON public.link_preview_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "app_lock_pins_self" ON public.app_lock_pins FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_subscriptions_self" ON public.push_subscriptions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 21. Threads & Messages
CREATE POLICY "message_threads_select" ON public.message_threads FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.group_members WHERE group_id = message_threads.group_id AND user_id = auth.uid()) OR public.is_admin());
CREATE POLICY "thread_messages_all" ON public.thread_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.message_threads t JOIN public.group_members gm ON gm.group_id = t.group_id WHERE t.id = thread_id AND gm.user_id = auth.uid()) OR public.is_admin())
  WITH CHECK (auth.uid() = sender_id);

-- 22. Notes, Reminders, and Channels
CREATE POLICY "user_notes_self" ON public.user_notes FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "reminders_self" ON public.reminders FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "availability_self" ON public.user_availability FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "slow_mode_select" ON public.slow_mode_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "channels_select" ON public.channel_subscriptions FOR SELECT TO authenticated USING (is_public = true OR auth.uid() = owner_id OR public.is_admin());
CREATE POLICY "channels_owner" ON public.channel_subscriptions FOR ALL TO authenticated USING (auth.uid() = owner_id OR public.is_admin()) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "channel_posts_select" ON public.channel_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "channel_members_self" ON public.channel_members FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "read_later_self" ON public.read_later FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_connections_parties" ON public.user_connections FOR ALL TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- 23. Payment Splits, Group Events, Highlights, Appeals, and Capsules
CREATE POLICY "splits_select" ON public.payment_splits FOR SELECT TO authenticated USING (true);
CREATE POLICY "split_items_all" ON public.payment_split_items FOR ALL TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.payment_splits s WHERE s.id = split_id AND s.created_by = auth.uid()))
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.payment_splits s WHERE s.id = split_id AND s.created_by = auth.uid()));

CREATE POLICY "custom_emoji_select" ON public.custom_emoji FOR SELECT TO authenticated USING (true);
CREATE POLICY "custom_emoji_admin" ON public.custom_emoji FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "group_events_select" ON public.group_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_events.group_id AND user_id = auth.uid()) OR public.is_admin());
CREATE POLICY "event_rsvps_self" ON public.event_rsvps FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stories_highlights_select" ON public.stories_highlights FOR SELECT TO authenticated USING (true);
CREATE POLICY "stories_highlights_self" ON public.stories_highlights FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "highlight_items_select" ON public.highlight_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "appeals_self" ON public.moderation_appeals FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "appeals_insert" ON public.moderation_appeals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "appeals_update_admin" ON public.moderation_appeals FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "user_badges_select" ON public.user_badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "leaderboards_select" ON public.leaderboards FOR SELECT TO authenticated USING (true);
CREATE POLICY "network_quality_self" ON public.network_quality_log FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "incognito_self" ON public.incognito_mode FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "trusted_contacts_self" ON public.trusted_contacts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "shared_notes_parties" ON public.shared_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "time_capsules_select" ON public.time_capsules FOR SELECT TO authenticated
  USING (is_public = true OR auth.uid() = created_by OR (unlock_at IS NOT NULL AND unlock_at <= now()));
CREATE POLICY "time_capsules_insert" ON public.time_capsules FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "chat_previews_select" ON public.chat_previews FOR SELECT TO anon, authenticated USING (expires_at > now());
CREATE POLICY "chat_previews_insert" ON public.chat_previews FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "clipboard_items_self" ON public.clipboard_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "archived_chats_self" ON public.archived_chats FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
