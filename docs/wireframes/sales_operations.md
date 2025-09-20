# Sales Operations Dashboard Wireframe

## Widget Data Attributes

### Kanban Pipeline
- `pipeline_id`: Unique identifier for the active pipeline configuration.
- `stage_id`: Immutable identifier for each stage used for routing API calls.
- `stage_name`: Human-readable label for the stage.
- `sequence`: Ordinal placement of the stage for column ordering.
- `deal_id`: CRM opportunity identifier.
- `deal_name`: Title of the opportunity.
- `account_name`: Company or customer name associated with the deal.
- `deal_value`: Monetary value for forecasting and totals.
- `currency`: ISO currency code for monetary values.
- `confidence`: Probability weighting applied to the revenue projection widget.
- `close_date`: Estimated close date used in projections.
- `rep_id`: Owner identifier that ties to rep-level analytics.
- `rep_name`: Display name of the deal owner.
- `owner_avatar_url`: Optional URL for rep imagery.
- `last_activity_at`: Timestamp of the last logged interaction.
- `next_step`: Planned action for the deal.
- `tags`: Array of string labels for filters and automations.
- `priority`: Enum used to surface escalations.
- `webhook_subscription_ids`: External automation hooks to trigger on stage changes.

### Call Metrics Console
- `reporting_window`: Object containing `start_at` and `end_at` timestamps.
- `rep_id`: Identifier matching the CRM owner.
- `rep_name`: Display name for UI.
- `call_volume`: Total outbound dials in the window.
- `connect_rate`: Percentage of calls reaching a live contact.
- `talk_time_minutes`: Aggregate talk time in minutes.
- `avg_handle_time`: Average call duration.
- `voicemail_drop_rate`: Percentage of automated voicemail drops.
- `dialer_session_count`: Number of dialer launches per rep.
- `dialer_launch_url`: Deep link that opens the integrated dialer.
- `dialer_provider`: Enum describing the third-party dialer vendor.
- `dialer_session_id`: Identifier for the most recent launch, used for webhook reconciliation.
- `webhook_event_types`: Supported dialer events subscribed via webhook.
- `last_synced_at`: Timestamp of the latest metric refresh.

### Script Drawer
- `script_id`: Unique identifier per script template.
- `title`: Script title shown in the drawer.
- `supported_stages`: Stage IDs that surface the script.
- `channel`: Communication medium supported (phone, email, etc.).
- `persona`: Target persona for personalization cues.
- `script_body`: Markdown-compatible script content.
- `dynamic_tokens`: Merge fields available for personalization.
- `compliance_notes`: Required legal disclosures.
- `playbook_links`: Supporting documentation references.
- `dialer_shortcuts`: Key-value map of dialer hotkeys to actions.
- `last_reviewed_at`: QA timestamp for content governance.

### Revenue Projection
- `forecast_window`: Date range (start/end) for forecast calculations.
- `rep_id`: Identifier for the rep or team segment.
- `rep_name`: Display label for the rep or segment.
- `weighted_pipeline_value`: Sum of deal values multiplied by confidence.
- `target_quota`: Target quota for the period.
- `attainment`: Percentage progress toward quota.
- `run_rate_projection`: Projected attainment based on pace.
- `stage_breakdown`: Array detailing contributions by `stage_id`.
- `scenario`: Enum describing forecast scenario (commit, best_case, stretch).
- `updated_at`: Timestamp of the last forecast refresh.

### Coaching Queue
- `call_id`: Identifier for the recorded call.
- `rep_id`: Owner of the call.
- `rep_name`: Display name of the rep.
- `call_date`: Timestamp of the conversation.
- `call_duration_minutes`: Duration of the call.
- `qa_score`: Quality assurance score.
- `review_status`: Enum tracking coaching progress.
- `coach_id`: Owner of the coaching task.
- `coach_name`: Display name for the coach.
- `call_recording_url`: Link to call recording asset.
- `transcript_url`: Link to transcript for accessibility.
- `focus_tags`: Topics or behaviors flagged for review.
- `webhook_event_id`: Identifier tying coaching events to webhook payloads.
- `follow_up_due_at`: Due date for coaching follow-up.

## Integration Checkpoints

### Pipeline Stage Identifiers
- Maintain an immutable `stage_id` catalogue synchronized with the CRM to power kanban ordering, projections, and script eligibility.
- Expose a metadata endpoint that returns the stage catalogue with `stage_id`, `stage_name`, `sequence`, and `is_closed_stage` flags for downstream services.
- Provide webhook callbacks on stage transitions using the `webhook_subscription_ids` declared above so automation tools can react in near real time.

### Dialer Launch & Webhook Capabilities
- Support deep links (`dialer_launch_url`) that can pre-load dialer context with `rep_id`, `deal_id`, and `call_list_id` parameters.
- Capture the `dialer_session_id` returned by the vendor SDK to correlate dialer events (connect, disposition, voicemail drop) with CRM updates.
- Register webhook subscriptions for `webhook_event_types` such as `dialer.call.connected`, `dialer.call.dispositioned`, and `dialer.session.ended`, storing their callbacks for retry logic.
- Confirm SSO compatibility or token exchange requirements when launching the dialer, and document fallback behavior for non-SSO reps.

### Accessibility & Compliance Requirements
- Provide keyboard navigation for kanban drag-and-drop, script drawer tabs, and coaching queue actions with visible focus states.
- Ensure color contrast ratios meet WCAG AA across pipeline badges, metrics cards, and status pills.
- Supply ARIA labels for interactive components, especially dialer launch buttons, script selection controls, and coaching action menus.
- Surface `compliance_notes` and required disclosures in the script drawer with screen-reader-friendly markup.

