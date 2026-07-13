import { Construction } from 'lucide-react'

// Placeholder for pages whose backing service ships in a later phase.
export default function ComingSoon({ service, phase }: { service: string; phase: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <Construction size={40} className="mb-4 text-gray-300" />
      <h2 className="text-lg font-semibold">{service} chưa sẵn sàng</h2>
      <p className="mt-1 max-w-md text-sm text-gray-500">
        Service này được xây ở {phase}. Giao diện sẽ được nối API khi service tương ứng hoàn tất.
      </p>
    </div>
  )
}
