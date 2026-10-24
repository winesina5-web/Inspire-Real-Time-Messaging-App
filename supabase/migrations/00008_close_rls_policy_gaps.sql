-- Close the RLS gaps identified in the security audit.
-- User-facing tables get owner/participant policies; internal caches and queues
-- remain available only to service-role code (and admins for read-only support).

-- User-owned AI personas.
DROP POLICY IF EXISTS ai_personas_owner_all ON public.ai_personas;
CREATE POLICY ai_personas_owner_all ON public.ai_personas
FOR ALL TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

-- Translation cache is visible only to participants of its source DM.
DROP POLICY IF EXISTS message_translations_cache_participant ON public.message_translations_cache;
CREATE POLICY message_translations_cache_participant ON public.message_translations_cache
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.messages m
  WHERE m.id = message_id
    AND (m.sender_id = (SELECT auth.uid()) OR m.receiver_id = (SELECT auth.uid()))
));
DROP POLICY IF EXISTS message_translations_cache_insert_participant ON public.message_translations_cache;
CREATE POLICY message_translations_cache_insert_participant ON public.message_translations_cache
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.messages m
  WHERE m.id = message_id
    AND (m.sender_id = (SELECT auth.uid()) OR m.receiver_id = (SELECT auth.uid()))
));

-- Bot subscriptions are managed by trusted Worker/admin code.
DROP POLICY IF EXISTS bot_subscriptions_admin_only ON public.bot_subscriptions;
CREATE POLICY bot_subscriptions_admin_only ON public.bot_subscriptions
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- User-owned quick message templates.
DROP POLICY IF EXISTS message_templates_owner_all ON public.message_templates;
CREATE POLICY message_templates_owner_all ON public.message_templates
FOR ALL TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

-- Channel post reactions require membership and can only be written by the actor.
DROP POLICY IF EXISTS channel_post_reactions_member_select ON public.channel_post_reactions;
CREATE POLICY channel_post_reactions_member_select ON public.channel_post_reactions
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.channel_posts cp
  JOIN public.channel_members cm ON cm.channel_id = cp.channel_id
  WHERE cp.id = channel_post_id AND cm.user_id = (SELECT auth.uid())
));
DROP POLICY IF EXISTS channel_post_reactions_insert_self ON public.channel_post_reactions;
CREATE POLICY channel_post_reactions_insert_self ON public.channel_post_reactions
FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.channel_posts cp
    JOIN public.channel_members cm ON cm.channel_id = cp.channel_id
    WHERE cp.id = channel_post_id AND cm.user_id = (SELECT auth.uid())
  )
);
DROP POLICY IF EXISTS channel_post_reactions_delete_self ON public.channel_post_reactions;
CREATE POLICY channel_post_reactions_delete_self ON public.channel_post_reactions
FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- Summary cache has no owner column, so do not expose conversation summaries to clients.
DROP POLICY IF EXISTS ai_summaries_cache_admin_read ON public.ai_summaries_cache;
CREATE POLICY ai_summaries_cache_admin_read ON public.ai_summaries_cache
FOR SELECT TO authenticated USING (public.is_admin());

-- Channel analytics are readable by channel members; writes stay server-side.
DROP POLICY IF EXISTS message_analytics_channel_member_read ON public.message_analytics;
CREATE POLICY message_analytics_channel_member_read ON public.message_analytics
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.channel_posts cp
  JOIN public.channel_members cm ON cm.channel_id = cp.channel_id
  WHERE cp.id = post_id AND cm.user_id = (SELECT auth.uid())
));
DROP POLICY IF EXISTS message_analytics_admin_all ON public.message_analytics;
CREATE POLICY message_analytics_admin_all ON public.message_analytics
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Channel reaction audit log is append-only for its owner and visible to channel members.
DROP POLICY IF EXISTS message_reactions_log_member_read ON public.message_reactions_log;
CREATE POLICY message_reactions_log_member_read ON public.message_reactions_log
FOR SELECT TO authenticated USING (
  user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.channel_posts cp
    JOIN public.channel_members cm ON cm.channel_id = cp.channel_id
    WHERE cp.id = post_id AND cm.user_id = (SELECT auth.uid())
  )
);
DROP POLICY IF EXISTS message_reactions_log_insert_self ON public.message_reactions_log;
CREATE POLICY message_reactions_log_insert_self ON public.message_reactions_log
FOR INSERT TO authenticated WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.channel_posts cp
    JOIN public.channel_members cm ON cm.channel_id = cp.channel_id
    WHERE cp.id = post_id AND cm.user_id = (SELECT auth.uid())
  )
);

-- Broadcast templates are platform-admin content.
DROP POLICY IF EXISTS broadcast_templates_admin_all ON public.broadcast_templates;
CREATE POLICY broadcast_templates_admin_all ON public.broadcast_templates
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Account recovery: users may create/read their own request; only admins may review it.
DROP POLICY IF EXISTS account_recovery_requests_owner_read ON public.account_recovery_requests;
CREATE POLICY account_recovery_requests_owner_read ON public.account_recovery_requests
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR public.is_admin());
DROP POLICY IF EXISTS account_recovery_requests_owner_insert ON public.account_recovery_requests;
CREATE POLICY account_recovery_requests_owner_insert ON public.account_recovery_requests
FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS account_recovery_requests_admin_update ON public.account_recovery_requests;
CREATE POLICY account_recovery_requests_admin_update ON public.account_recovery_requests
FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Group read receipts are limited to the member who owns the receipt and group members.
DROP POLICY IF EXISTS group_message_reads_member_all ON public.group_message_reads;
CREATE POLICY group_message_reads_member_all ON public.group_message_reads
FOR ALL TO authenticated
USING (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.group_messages gm
    JOIN public.group_members gmem ON gmem.group_id = gm.group_id
    WHERE gm.id = group_message_id AND gmem.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.group_messages gm
    JOIN public.group_members gmem ON gmem.group_id = gm.group_id
    WHERE gm.id = group_message_id AND gmem.user_id = (SELECT auth.uid())
  )
);

-- Owner-controlled preference and dismissal tables.
DROP POLICY IF EXISTS translation_settings_owner_all ON public.translation_settings;
CREATE POLICY translation_settings_owner_all ON public.translation_settings
FOR ALL TO authenticated USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS dismissed_suggestions_owner_all ON public.dismissed_suggestions;
CREATE POLICY dismissed_suggestions_owner_all ON public.dismissed_suggestions
FOR ALL TO authenticated USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

-- Notification queue is internal delivery state; only admins may inspect it.
DROP POLICY IF EXISTS notification_queue_admin_read ON public.notification_queue;
CREATE POLICY notification_queue_admin_read ON public.notification_queue
FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS deletion_requests_owner_all ON public.deletion_requests;
CREATE POLICY deletion_requests_owner_all ON public.deletion_requests
FOR ALL TO authenticated USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS user_conversation_analytics_cache_owner_all ON public.user_conversation_analytics_cache;
CREATE POLICY user_conversation_analytics_cache_owner_all ON public.user_conversation_analytics_cache
FOR ALL TO authenticated USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));
