from allauth.account.adapter import DefaultAccountAdapter
from .tasks import send_email_async

class AsyncAccountAdapter(DefaultAccountAdapter):
    def send_mail(self, template_prefix, email, context):
        msg = self.render_mail(template_prefix, email, context)
        # Preserve the HTML part (if allauth rendered one) instead of sending the
        # text body alone. The rendered strings are JSON-serializable, so they
        # survive a real Celery broker (CELERY_TASK_SERIALIZER='json').
        html_message = next(
            (content for content, mimetype in msg.alternatives if mimetype == "text/html"),
            None,
        )
        send_email_async.delay(msg.subject, msg.body, msg.from_email, [email], html_message)
