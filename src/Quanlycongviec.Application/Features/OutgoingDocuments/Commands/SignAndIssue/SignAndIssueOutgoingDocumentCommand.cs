using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.OutgoingDocuments.Commands.SignAndIssue
{
    public class SignAndIssueOutgoingDocumentCommand : IRequest<string>
    {
        public Guid Id { get; set; }
        public Guid RequestId { get; set; }
        public Guid? Version { get; set; }
        public Guid UserId { get; set; }
        public int UserRankLevel { get; set; } = 5; // Default Chuyên viên
    }

    public class SignAndIssueOutgoingDocumentCommandHandler(IApplicationDbContext context, INotificationDispatcher? dispatcher = null) : IRequestHandler<SignAndIssueOutgoingDocumentCommand, string>
    {
        public async Task<string> Handle(SignAndIssueOutgoingDocumentCommand request, CancellationToken ct)
        {
            var id = await new Quanlycongviec.Application.Common.Services.OutgoingDocumentWorkflow(context, dispatcher)
                .ActAsync(request.UserId, request.Id, "sign", new() { RequestId = request.RequestId, Version = request.Version }, ct);
            return await context.OutgoingDocuments.Where(d => d.Id == id).Select(d => d.DocumentNumber!).SingleAsync(ct);
        }

        public static string GetTypeAbbreviation(DocumentTypeEnum type) => type switch
        {
            DocumentTypeEnum.QuyetDinh => "QĐ",
            DocumentTypeEnum.CongVan => "CV",
            DocumentTypeEnum.ThongBao => "TB",
            DocumentTypeEnum.BaoCao => "BC",
            DocumentTypeEnum.KeHoach => "KH",
            DocumentTypeEnum.ToTrinh => "TTr",
            DocumentTypeEnum.CongDien => "CĐ",
            _ => "VB"
        };
    }
}
