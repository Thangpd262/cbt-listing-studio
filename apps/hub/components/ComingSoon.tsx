import { Construction } from 'lucide-react'

// Placeholder for pages whose backing service ships in a later phase.
export default function ComingSoon({ service, phase }: { service: string; phase: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-panel2 text-muted">
        <Construction size={30} />
      </div>
      <h2 className="text-lg font-semibold text-fg">{service} chưa sẵn sàng</h2>
      <p className="mt-1.5 max-w-md text-sm text-muted">
        Service này được xây ở {phase}. Giao diện sẽ được nối API khi service tương ứng hoàn tất.
      </p>
    </div>
  )
}
