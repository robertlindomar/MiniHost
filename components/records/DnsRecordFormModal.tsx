import { Modal } from "@/components/ui/Modal";
import { DnsRecordForm } from "@/components/forms/DnsRecordForm";
import type { DnsRecord, DnsRecordFormInput, Domain } from "@/lib/types";

interface DnsRecordFormModalProps {
  isOpen: boolean;
  domains: Domain[];
  initialData?: DnsRecord;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (input: DnsRecordFormInput) => void | Promise<void>;
}

export function DnsRecordFormModal({
  isOpen,
  domains,
  initialData,
  isSubmitting = false,
  onClose,
  onSubmit
}: DnsRecordFormModalProps) {
  const isEditing = Boolean(initialData);
  const isCloudflareLinked = Boolean(initialData?.cloudflareRecordId);
  const titleInfo =
    isEditing && isCloudflareLinked
      ? "Este registro está vinculado à Cloudflare. As alterações serão aplicadas na sua zona DNS pública."
      : undefined;

  return (
    <Modal
      isOpen={isOpen}
      title={isEditing ? "Editar registro DNS" : "Novo registro DNS"}
      titleInfo={titleInfo}
      onClose={onClose}
      size="lg"
    >
      <DnsRecordForm
        key={initialData?.id ?? "new"}
        domains={domains}
        initialData={initialData}
        isSubmitting={isSubmitting}
        onCancel={onClose}
        onSubmit={onSubmit}
        submitLabel="Salvar alterações"
      />
    </Modal>
  );
}
