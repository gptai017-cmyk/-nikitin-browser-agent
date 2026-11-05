"""Ports for future *approved* bank (SBP) and guarding/control-room providers.

No actual bank or control room is configured by these interfaces.
Never trust client-reported PAID or ACTIVE; only a separately audited adapter
can produce a verified callback or confirmed provider activation.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Protocol, Mapping

@dataclass(frozen=True)
class VerifiedPayment:
    payment_id: str
    bank_event_id: str
    bank_transaction_id: str
    actual_amount_kopecks: int
    bank_fee_kopecks: int
    status: str

@dataclass(frozen=True)
class VerifiedRefund:
    payment_id: str
    bank_refund_id: str
    refunded_kopecks: int

class PaymentProvider(Protocol):
    """Live adapter chosen only with signed Pride–bank contract and production keys."""
    def create_sbp_invoice(self, *, payment_id: str, contract_id: str, amount_kopecks: int) -> Mapping:
        ...
    def verify_webhook(self, *, raw_body: bytes, headers: Mapping[str,str]) -> VerifiedPayment | VerifiedRefund:
        ...

class SecurityProviderAPI(Protocol):
    """Future integration with Si-Nord, Pritok-A or another licensed PCC/PCN."""
    def register_client(self, *, contract_id: str, client_id: str) -> str:
        ...
    def register_object(self, *, contract_id: str, object_id: str, address: str) -> str:
        ...
    def register_user(self, *, object_id: str, user_id: str) -> str:
        ...
    def confirm_activation(self, *, external_object_id: str) -> bool:
        ...

class IntegrationDisabled(RuntimeError):
    pass

class DisabledPaymentProvider:
    def create_sbp_invoice(self, **_kwargs):
        raise IntegrationDisabled("bank_account_and_sbp_contract_not_configured")
    def verify_webhook(self, **_kwargs):
        raise IntegrationDisabled("bank_webhook_signature_adapter_not_configured")

class DisabledSecurityProvider:
    def register_client(self, **_kwargs):
        raise IntegrationDisabled("pсn_not_connected")
    def register_object(self, **_kwargs):
        raise IntegrationDisabled("pсn_not_connected")
    def register_user(self, **_kwargs):
        raise IntegrationDisabled("pсn_not_connected")
    def confirm_activation(self, **_kwargs):
        raise IntegrationDisabled("pсn_not_connected")
